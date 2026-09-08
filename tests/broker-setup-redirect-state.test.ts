import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {
  getBrokerOnboardingStatus,
  isBrokerSetupComplete,
  resolveBrokerOnboardingDestination,
} from '../lib/broker-onboarding-state'

const read = (path: string) => fs.readFileSync(path, 'utf8')

type User = {
  role?: string | null
  brokerProfile?: unknown | null
  brokerRegistration?: {
    subscription?: { isActive?: boolean | null; status?: string | null } | null
  } | null
}

const activeSub = { isActive: true, status: 'ACTIVE' }
const pendingSub = { isActive: false, status: 'PENDING' }

// ===========================================================================
// Authoritative state machine (runtime)
// ===========================================================================

test('state machine: incomplete broker with active subscription -> /setup', () => {
  const user: User = { role: 'BROKER', brokerProfile: null, brokerRegistration: { subscription: activeSub } }
  assert.equal(getBrokerOnboardingStatus(user), 'ONBOARDING_IN_PROGRESS')
  assert.equal(resolveBrokerOnboardingDestination(user, '/broker/dashboard'), '/setup')
  assert.equal(resolveBrokerOnboardingDestination(user, '/setup'), null, 'already on the correct page')
})

test('state machine: draft broker (no profile, active subscription) -> /setup, never /dashboard', () => {
  // A saved draft is NOT completion: draft brokers stay on /setup.
  const user: User = { role: 'BROKER', brokerProfile: null, brokerRegistration: { subscription: activeSub } }
  assert.equal(isBrokerSetupComplete(user), false, 'draft broker must not be treated as complete')
  assert.equal(resolveBrokerOnboardingDestination(user, '/broker/dashboard'), '/setup')
})

test('state machine: completed broker -> /broker/dashboard', () => {
  const user: User = { role: 'BROKER', brokerProfile: { id: 'b1' }, brokerRegistration: { subscription: activeSub } }
  assert.equal(getBrokerOnboardingStatus(user), 'COMPLETED')
  assert.equal(resolveBrokerOnboardingDestination(user, '/setup'), '/broker/dashboard')
  assert.equal(resolveBrokerOnboardingDestination(user, '/broker/dashboard'), null)
})

test('state machine: completed broker with no registration (claim/admin flow) -> dashboard', () => {
  const user: User = { role: 'BROKER', brokerProfile: { id: 'b1' }, brokerRegistration: null }
  assert.equal(resolveBrokerOnboardingDestination(user, '/setup'), '/broker/dashboard')
})

test('state machine: pending / in-progress broker stays on /setup (legacy plan select retired) and is redirected away from dashboard', () => {
  const user: User = { role: 'BROKER', brokerProfile: null, brokerRegistration: { subscription: pendingSub } }
  assert.equal(getBrokerOnboardingStatus(user), 'SUBSCRIPTION_PENDING')
  assert.equal(resolveBrokerOnboardingDestination(user, '/broker/dashboard'), '/setup')
  assert.equal(resolveBrokerOnboardingDestination(user, '/setup'), null, 'profile preparation on /setup is permitted')
  assert.equal(resolveBrokerOnboardingDestination(user, '/broker/subscription/select'), '/setup', 'legacy plan select redirects to /setup')
})

test('state machine: BROKER with no registration -> /register', () => {
  const user: User = { role: 'BROKER', brokerProfile: null, brokerRegistration: null }
  assert.equal(getBrokerOnboardingStatus(user), 'NOT_STARTED')
  assert.equal(resolveBrokerOnboardingDestination(user, '/broker/dashboard'), '/register')
  assert.equal(resolveBrokerOnboardingDestination(user, '/setup'), '/register')
})

test('state machine: unauthenticated -> signin', () => {
  assert.equal(resolveBrokerOnboardingDestination(null, '/setup'), '/auth/signin')
  assert.equal(resolveBrokerOnboardingDestination(undefined, '/broker/dashboard'), '/auth/signin')
})

test('state machine: non-broker roles go to their role home', () => {
  const user: User = { role: 'USER', brokerProfile: null, brokerRegistration: null }
  assert.equal(resolveBrokerOnboardingDestination(user, '/setup'), '/')
  const admin: User = { role: 'ADMIN', brokerProfile: null }
  assert.equal(resolveBrokerOnboardingDestination(admin, '/setup'), '/admin')
})

// ===========================================================================
// No-loop guarantee
// ===========================================================================

test('no state can bounce between /setup and /broker/dashboard', () => {
  const states: Array<User | null | undefined> = [
    null,
    undefined,
    { role: 'BROKER', brokerProfile: null, brokerRegistration: null },
    { role: 'BROKER', brokerProfile: null, brokerRegistration: { subscription: pendingSub } },
    { role: 'BROKER', brokerProfile: null, brokerRegistration: { subscription: activeSub } },
    { role: 'BROKER', brokerProfile: { id: 'b1' }, brokerRegistration: null },
    { role: 'BROKER', brokerProfile: { id: 'b1' }, brokerRegistration: { subscription: activeSub } },
    { role: 'BROKER', brokerProfile: { id: 'b1' }, brokerRegistration: { subscription: pendingSub } },
    { role: 'USER', brokerProfile: null },
    { role: 'ADMIN', brokerProfile: null },
  ]

  for (const user of states) {
    const fromSetup = resolveBrokerOnboardingDestination(user, '/setup')
    const fromDashboard = resolveBrokerOnboardingDestination(user, '/broker/dashboard')

    // A page renders only when the machine says it is the correct page. If
    // /setup redirects to /dashboard, then /dashboard must NOT redirect back
    // to /setup for the SAME snapshot.
    if (fromSetup === '/broker/dashboard') {
      assert.notEqual(fromDashboard, '/setup', 'setup -> dashboard must not be followed by dashboard -> setup')
    }
    if (fromDashboard === '/setup') {
      assert.notEqual(fromSetup, '/broker/dashboard', 'dashboard -> setup must not be followed by setup -> dashboard')
    }
    // And the destination is the same page regardless of which page you start on.
    const canonical = fromSetup ?? '/setup'
    if (fromDashboard !== null) {
      assert.equal(fromDashboard, canonical, `stable canonical destination for ${JSON.stringify(user)}`)
    }
  }
})

// ===========================================================================
// Both pages share the single authority (static)
// ===========================================================================

test('/setup and /broker/dashboard both call the shared resolve function', () => {
  const setup = read('app/setup/page.tsx')
  const dashboard = read('app/broker/dashboard/page.tsx')
  assert.match(setup, /resolveBrokerOnboardingDestination\(user, '\/setup'\)/)
  assert.match(dashboard, /resolveBrokerOnboardingDestination\(user, '\/broker\/dashboard'\)/)
})

// ===========================================================================
// Loading-state protection (static)
// ===========================================================================

test('no client-side redirect decision based on a still-loading request', () => {
  const setup = read('app/setup/page.tsx')
  // /setup is server-rendered: the redirect decision is made after getCurrentUser
  // resolves, never against a client "loading" placeholder.
  assert.doesNotMatch(setup, /status === 'loading'/)
  assert.doesNotMatch(setup, /fetch\('\/api\/broker-registration\/status'\)/)
  const dashboard = read('app/broker/dashboard/page.tsx')
  // The dashboard awaits getCurrentUser() before any redirect.
  assert.match(dashboard, /const user = await getCurrentUser\(\)/)
  const redirectBlock = dashboard.slice(dashboard.indexOf('if (!isBrokerSetupComplete'), dashboard.indexOf('// Fetch contact messages'))
  assert.ok(redirectBlock.trim().length > 0, 'redirect decision present after data load')
})

// ===========================================================================
// Draft restoration (static: setup feeds the server draft into the wizard)
// ===========================================================================

test('/setup restores draft data and current step server-side on every request', () => {
  const setup = read('app/setup/page.tsx')
  assert.match(setup, /brokerRegistration\?\.draft/)
  assert.match(setup, /draft\.data/)
  assert.match(setup, /draft\?\.currentStep/)
  assert.match(setup, /initialData=\{initialData\}/)
  assert.match(setup, /initialStep=\{initialStep\}/)
  assert.doesNotMatch(setup, /reset\(\)/, 'setup must never reset the form on mount')
})

test('draft restoration preserves the persisted field set including location and licensing', () => {
  const draft = read('app/api/broker-registration/onboarding/route.ts')
  for (const field of [
    'displayName', 'companyName', 'description', 'logo', 'profileSlug',
    'phone', 'whatsapp', 'email', 'website',
    'officeAddress', 'city', 'state', 'pinCode',
    'googlePlaceId', 'locationCountryCode', 'location',
    'experienceYears', 'bankPartnerships',
    'nmls', 'licenseStates', 'profileImage', 'coverImage',
  ]) {
    assert.match(draft, new RegExp(`'${field}'`), `draft must persist ${field}`)
  }
})

test('wizard maps legacy zipCode drafts back to the canonical pinCode field', () => {
  const wizard = read('components/sections/broker/BrokerSetupWizard.tsx')
  assert.match(wizard, /zipCode/)
  assert.match(wizard, /restored\.pinCode = restored\.zipCode/)
})

// ===========================================================================
// Unauthorized / auth edge cases
// ===========================================================================

test('unauthenticated /setup redirects to signin', () => {
  const setup = read('app/setup/page.tsx')
  assert.match(setup, /if \(!user\)/)
  assert.match(setup, /redirect\('\/auth\/signin'\)/)
})

test('setup page has no client fetch/redirect effect that could misfire on reload', () => {
  const setup = read('app/setup/page.tsx')
  assert.doesNotMatch(setup, /useEffect/)
  assert.doesNotMatch(setup, /useRouter/)
})
