import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')

test('broker email registration collects account data only', () => {
  const page = read('app/(public)/auth/signup/page.tsx')
  const route = read('app/api/auth/register/broker/route.ts')

  assert.match(page, /name="name"/)
  assert.match(page, /name="email"/)
  assert.match(page, /name="password"/)
  assert.match(page, /name="confirmPassword"/)
  assert.doesNotMatch(page, /name="phone"|name="companyName"|name="officeAddress"|name="serviceCities"/)
  assert.match(route, /createBrokerRegistration/)
  assert.doesNotMatch(route, /createBrokerAccount/)
  assert.doesNotMatch(route, /companyName|officeAddress|serviceCities|pinCode/)
})

test('broker registration has separate pre-profile state and subscription ownership', () => {
  const schema = read('prisma/schema.prisma')
  assert.match(schema, /model BrokerRegistration \{/) 
  assert.match(schema, /model BrokerRegistrationSubscription \{/) 
  assert.match(schema, /model BrokerOnboardingDraft \{/) 
  assert.match(schema, /registrationId String\s+@unique/) 
  assert.match(schema, /BrokerRegistrationSubscriptionStatus/) 
  assert.match(read('app/api/broker-registration/subscription/free/route.ts'), /no Stripe|brokerRegistrationSubscription/)
  assert.match(read('app/api/broker-registration/subscription/checkout/route.ts'), /withBillingLock\(`broker-registration:/)
})

test('Google broker intent is explicit and session-safe', () => {
  const button = read('components/auth/GoogleContinueButton.tsx')
  const register = read('app/(public)/register/page.tsx')
  const intent = read('app/api/auth/broker-intent/route.ts')
  const continuation = read('app/broker-registration/continue/page.tsx')

  assert.match(button, /brokerIntent = false/)
  assert.match(button, /\/api\/auth\/broker-intent/)
  assert.match(register, /brokerIntent/)
  assert.match(intent, /isSameOriginRequest/)
  assert.match(intent, /establishBrokerRegistration/)
  assert.match(continuation, /refreshSession/)
})

test('verification routes broker registrations to plan without a client delay', () => {
  const verify = read('app/api/auth/verify-email/route.ts')
  const page = read('app/(public)/auth/verify-email/page.tsx')
  const auth = read('lib/auth.config.ts')
  assert.match(verify, /updatedUser\.brokerRegistration\?\.id \? '\/broker\/subscription\/select'/)
  assert.match(verify, /signIn\('credentials'/)
  assert.match(verify, /verificationToken: token/)
  assert.match(auth, /verificationToken: \{ label: "Verification token"/)
  assert.match(auth, /updateMany\(\{/)
  assert.match(page, /router\.push\(data\.data\?\.redirectTo \|\| '\/'\)/)
  assert.doesNotMatch(page, /setTimeout\(\(\) => \{\s*router\.push/)
})

test('setup requires active pre-profile subscription and saves durable draft progress', () => {
  const setup = read('app/setup/page.tsx')
  const state = read('lib/broker-onboarding-state.ts')
  const status = read('app/api/broker-registration/status/route.ts')
  const draft = read('app/api/broker-registration/onboarding/route.ts')
  const brokerRoute = read('app/api/brokers/route.ts')

  // Subscription gating lives in the single authoritative state machine and
  // is enforced server-side by the /setup page.
  assert.match(setup, /resolveBrokerOnboardingDestination\(user, '\/setup'\)/)
  assert.match(state, /'\/broker\/subscription\/select'/)
  assert.match(status, /subscription/)
  assert.match(draft, /DRAFT_FIELDS/)
  assert.match(draft, /brokerOnboardingDraft\.upsert/)
  assert.match(brokerRoute, /BrokerSubscriptionRequiredError|active broker subscription is required/i)
})
