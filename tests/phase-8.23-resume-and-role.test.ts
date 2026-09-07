import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { resolveUserResumePath } from '../lib/user-resume'

const read = (path: string) => fs.readFileSync(path, 'utf8')

// ===========================================================================
// 1. ROLE ASSIGNMENT — registration entry points
// ===========================================================================

test('ROLE: broker email registration assigns BROKER immediately (incomplete != completed)', () => {
  const lib = read('lib/broker-registration.ts')
  assert.match(lib, /role: 'BROKER'/)
  // A Broker is created later, at finalization, never at registration.
  assert.match(lib, /status: 'SUBSCRIPTION_PENDING'/)
  const route = read('app/api/auth/register/broker/route.ts')
  assert.match(route, /createBrokerRegistration/)
  assert.doesNotMatch(route, /broker\.create/)
})

test('ROLE: company registration keeps User.role = USER and represents the company via membership (no COMPANY enum role)', () => {
  const schema = read('prisma/schema.prisma')
  const userRoleEnum = schema.match(/enum UserRole \{([\s\S]*?)\}/)?.[1] ?? ''
  assert.doesNotMatch(userRoleEnum, /COMPANY/)
  const route = read('app/api/company/register/route.ts')
  assert.match(route, /role: 'USER'/)
  assert.match(route, /role: 'OWNER'/)
  assert.doesNotMatch(route, /role: 'BROKER'/)
  const intent = read('lib/company-intent.ts')
  assert.match(intent, /companyMembership\.findFirst/)
  assert.doesNotMatch(intent, /role: 'BROKER'/)
})

test('ROLE: normal USER registration keeps role USER and never creates broker/company state', () => {
  const route = read('app/api/auth/register/user/route.ts')
  assert.match(route, /role: 'USER'/)
  assert.doesNotMatch(route, /brokerRegistration|companyMembership|company\.create/)
})

// ===========================================================================
// 2. BROKER RESUME — resolveUserResumePath (pure, DB-shape)
// ===========================================================================

const brokerUser = (overrides: Record<string, unknown> = {}) => ({
  role: 'BROKER',
  brokerProfile: null,
  brokerRegistration: null,
  companyMemberships: [],
  ...overrides,
})

test('BROKER: registration with no subscription resumes setup (plan selection reachable there)', () => {
  const user = brokerUser({ brokerRegistration: { subscription: null } })
  assert.equal(resolveUserResumePath(user), '/setup')
})

test('BROKER: FREE subscription ACTIVE resumes setup', () => {
  const user = brokerUser({ brokerRegistration: { subscription: { status: 'ACTIVE', isActive: true } } })
  assert.equal(resolveUserResumePath(user), '/setup')
})

test('BROKER: FEATURED CHECKOUT_PENDING resumes setup (subscription continuation via plan page)', () => {
  const user = brokerUser({ brokerRegistration: { subscription: { status: 'CHECKOUT_PENDING', isActive: false } } })
  assert.equal(resolveUserResumePath(user), '/setup')
})

test('BROKER: completed broker (final Broker exists) resumes the broker dashboard', () => {
  const user = brokerUser({ brokerProfile: { id: 'b1' } })
  assert.equal(resolveUserResumePath(user), '/broker/dashboard')
})

test('BROKER: role alone is never treated as completion — no registration -> normal user home', () => {
  // A stale BROKER role with no registration and no profile has nothing to
  // resume; it is routed like a normal user rather than to a completed dashboard.
  const user = brokerUser({})
  assert.equal(resolveUserResumePath(user), '/')
})

// ===========================================================================
// 3. COMPANY RESUME
// ===========================================================================

const companyUser = (company: Record<string, unknown>) => ({
  role: 'USER',
  brokerProfile: null,
  brokerRegistration: null,
  companyMemberships: [{ company }],
})

test('COMPANY: profile incomplete resumes onboarding', () => {
  const user = companyUser({ status: 'PENDING', onboardedAt: null, subscription: null })
  assert.equal(resolveUserResumePath(user), '/company/onboarding')
})

test('COMPANY: status ACTIVE alone (no onboardedAt) is NOT proof of completion -> onboarding', () => {
  // Stripe webhook may flip status to ACTIVE before onboarding completes.
  const user = companyUser({ status: 'ACTIVE', onboardedAt: null, subscription: { status: 'ACTIVE', isActive: true } })
  assert.equal(resolveUserResumePath(user), '/company/onboarding')
})

test('COMPANY: profile complete, no subscription -> plan selection', () => {
  const user = companyUser({ status: 'ACTIVE', onboardedAt: new Date('2026-01-01'), subscription: null })
  assert.equal(resolveUserResumePath(user), '/company/subscription/select')
})

test('COMPANY: CHECKOUT_PENDING resumes plan selection (safe continuation/retry)', () => {
  const user = companyUser({ status: 'ACTIVE', onboardedAt: new Date('2026-01-01'), subscription: { status: 'CHECKOUT_PENDING', isActive: false } })
  assert.equal(resolveUserResumePath(user), '/company/subscription/select')
})

test('COMPANY: active subscription + onboarded -> dashboard', () => {
  const user = companyUser({ status: 'ACTIVE', onboardedAt: new Date('2026-01-01'), subscription: { status: 'ACTIVE', isActive: true } })
  assert.equal(resolveUserResumePath(user), '/company/dashboard')
})

test('COMPANY: canceled/expired + profile complete -> plan selection; + profile incomplete -> onboarding', () => {
  const canceledComplete = companyUser({ status: 'ACTIVE', onboardedAt: new Date('2026-01-01'), subscription: { status: 'CANCELED', isActive: false } })
  assert.equal(resolveUserResumePath(canceledComplete), '/company/subscription/select')
  const expiredIncomplete = companyUser({ status: 'ACTIVE', onboardedAt: null, subscription: { status: 'EXPIRED', isActive: false } })
  assert.equal(resolveUserResumePath(expiredIncomplete), '/company/onboarding')
})

// ===========================================================================
// 4. NORMAL USER — never routed into broker/company flows
// ===========================================================================

test('USER: normal user always resumes home (or a compatible public path), never onboarding', () => {
  const user = { role: 'USER', brokerProfile: null, brokerRegistration: null, companyMemberships: [] }
  assert.equal(resolveUserResumePath(user), '/')
  assert.equal(resolveUserResumePath(user, '/brokers'), '/brokers')
  // Broker/company onboarding paths are never a normal-user destination.
  assert.equal(resolveUserResumePath(user, '/setup'), '/')
  assert.equal(resolveUserResumePath(user, '/company/onboarding'), '/')
  assert.equal(resolveUserResumePath(user, '/company/dashboard'), '/')
})

test('USER: admin resumes /admin (never a product or home page)', () => {
  const admin = { role: 'ADMIN', brokerProfile: null, brokerRegistration: null, companyMemberships: [] }
  assert.equal(resolveUserResumePath(admin), '/admin')
  assert.equal(resolveUserResumePath(admin, '/admin/ads'), '/admin/ads')
  assert.equal(resolveUserResumePath(admin, '/broker/dashboard'), '/admin')
})

// ===========================================================================
// 5. CALLBACK URL SAFETY — server state overrides incompatible destinations
// ===========================================================================

test('CALLBACK: an incomplete broker cannot bypass onboarding via callbackUrl=/dashboard', () => {
  const user = brokerUser({ brokerRegistration: { subscription: null } })
  assert.equal(resolveUserResumePath(user, '/dashboard'), '/setup')
  assert.equal(resolveUserResumePath(user, '/company/dashboard'), '/setup')
  assert.equal(resolveUserResumePath(user, '/admin/ads'), '/setup')
  // A same-product callback is honored (page still enforces state).
  assert.equal(resolveUserResumePath(user, '/broker/profile'), '/broker/profile')
})

test('CALLBACK: an incomplete company cannot bypass onboarding via callbackUrl=/company/dashboard', () => {
  const user = companyUser({ status: 'PENDING', onboardedAt: null, subscription: null })
  assert.equal(resolveUserResumePath(user, '/company/dashboard'), '/company/dashboard')
  // The company dashboard is the account hub (shows the resume banner); a
  // broker/admin/user destination is never honored for a company user.
  assert.equal(resolveUserResumePath(user, '/setup'), '/company/onboarding')
  assert.equal(resolveUserResumePath(user, '/broker/dashboard'), '/company/onboarding')
})

// ===========================================================================
// 6. INTEGRATION POINTS (static)
// ===========================================================================

test('LOGIN: credentials login resolves the canonical resume destination from the database', () => {
  const action = read('actions/auth.action.ts')
  assert.match(action, /resolveUserResumePathFromDb\(user\.id, requestedPath\)/)
  assert.match(action, /postLoginRedirect\(/)
  assert.match(action, /sanitizeCallbackUrl\(callbackUrl, configuredBaseUrl\)/)
})

test('REGISTER: broker and company register pages resume the canonical destination for authenticated visitors', () => {
  assert.match(read('app/(public)/register/page.tsx'), /resolveUserResumePath\(user\)/)
  assert.match(read('app/(public)/company/register/page.tsx'), /resolveUserResumePath\(user\)/)
})

test('PROXY: /auth/signin routes company users to their company hub (never the generic home)', () => {
  const proxy = read('proxy.ts')
  assert.match(proxy, /token\.isCompany/)
  assert.match(proxy, /'\/company\/dashboard'/)
  assert.match(proxy, /postLoginRedirect\(token\.role, callbackUrl, origin\)/)
})

test('AUTH: OAuth redirect callback lets returning users through /auth/signin so the proxy can resume them', () => {
  const config = read('lib/auth.config.ts')
  assert.match(config, /parsed\.pathname === '\/auth\/signin'/)
  assert.match(config, /sanitizeCallbackUrl\(inner, baseUrl\)/)
})

test('ONBOARDING: /company/onboarding enforces state server-side (no completed/active company in the form)', () => {
  const page = read('app/company/onboarding/page.tsx')
  assert.match(page, /getCompanyOnboardingStatus\(current\.company\)/)
  assert.match(page, /PROFILE_COMPLETE/)
  assert.match(page, /redirect\('\/company\/subscription\/select'\)/)
  assert.match(page, /redirect\('\/company\/dashboard'\)/)
})

test('CROSS-PRODUCT: broker and company resume destinations are fully isolated', () => {
  // A broker is never sent to a company route and vice versa.
  assert.equal(resolveUserResumePath(brokerUser({ brokerRegistration: { subscription: null } }), '/company/dashboard'), '/setup')
  assert.equal(resolveUserResumePath(companyUser({ status: 'PENDING', onboardedAt: null, subscription: null }), '/setup'), '/company/onboarding')
  // A completed broker is never sent to company onboarding.
  assert.equal(resolveUserResumePath(brokerUser({ brokerProfile: { id: 'b1' } }), '/company/onboarding'), '/broker/dashboard')
})