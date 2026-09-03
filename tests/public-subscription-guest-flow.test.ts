import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')

const subscriptionPage = read('app/(public)/subscription/page.tsx')
const signupPage = read('app/(public)/auth/signup/page.tsx')
const verifyEmailRoute = read('app/api/auth/verify-email/route.ts')
const brokerIntentRoute = read('app/api/auth/broker-intent/route.ts')
const subscriptionSelectPage = read('app/broker/subscription/select/page.tsx')
const googleButton = read('components/auth/GoogleContinueButton.tsx')
const brokerIntentLib = read('lib/broker-intent.ts')

// ============================================================================
// GUEST FLOW TESTS
// ============================================================================

test('Public subscription page: imports useSession', () => {
  assert.match(subscriptionPage, /from 'next-auth\/react'/)
})

test('Public subscription page: handleSelect checks auth status', () => {
  assert.match(subscriptionPage, /status === 'authenticated'/)
})

test('Public subscription page: unauthenticated redirects to /auth/signup with plan', () => {
  assert.match(subscriptionPage, /\/auth\/signup\?plan=/)
})

test('Public subscription page: authenticated redirects to /broker/subscription/select with plan', () => {
  assert.match(subscriptionPage, /\/broker\/subscription\/select\?plan=/)
})

test('Public subscription page: does NOT call checkout API directly', () => {
  assert.doesNotMatch(subscriptionPage, /\/api\/subscription\/checkout/)
})

test('Public subscription page: passes plan code to PricingCard', () => {
  assert.match(subscriptionPage, /code=\{plan\.code\}/)
})

// ============================================================================
// SIGNUP PAGE TESTS
// ============================================================================

test('Signup: reads plan from URL searchParams', () => {
  assert.match(signupPage, /searchParams\.get\('plan'\)/)
})

test('Signup: validates plan against VALID_PLAN_CODES', () => {
  assert.match(signupPage, /VALID_PLAN_CODES/)
})

test('Signup: preserves plan through registration redirect', () => {
  assert.match(signupPage, /redirectTo.*plan=/)
})

// ============================================================================
// BROKER-INTENT COOKIE TESTS
// ============================================================================

test('Broker-intent POST sets cookie with validated plan', () => {
  assert.match(brokerIntentRoute, /POST/)
  assert.match(brokerIntentRoute, /brokerIntentValue\(plan\)/)
  assert.match(brokerIntentRoute, /BROKER_INTENT_COOKIE/)
})

test('Broker-intent PUT establishes registration with plan from cookie', () => {
  assert.match(brokerIntentRoute, /PUT/)
  assert.match(brokerIntentRoute, /getBrokerRegistrationIntentPlan/)
  assert.match(brokerIntentRoute, /redirectTo.*plan=/)
})

test('Broker-intent lib: validates FREE and FEATURED only', () => {
  assert.ok(brokerIntentLib.includes('FREE') && brokerIntentLib.includes('FEATURED'))
  assert.match(brokerIntentLib, /FREE.*FEATURED/)
})

// ============================================================================
// EMAIL VERIFICATION TESTS
// ============================================================================

test('Verify-email: preserves plan from intent cookie on redirect', () => {
  assert.match(verifyEmailRoute, /appendPlanToRedirect/)
  assert.match(verifyEmailRoute, /\/broker\/subscription\/select/)
})

test('Verify-email: validates plan before using it', () => {
  assert.match(verifyEmailRoute, /sanitizePlan/)
  assert.match(verifyEmailRoute, /VALID_PLAN_CODES/)
})

// ============================================================================
// SUBSCRIPTION SELECT TESTS
// ============================================================================

test('Subscription select: reads plan from URL searchParams', () => {
  assert.match(subscriptionSelectPage, /searchParams\.get\('plan'\)/)
})

test('Subscription select: preselects valid plan from URL', () => {
  assert.match(subscriptionSelectPage, /setSelectedPlanCode\(planParam\)/)
})

test('Subscription select: validates plan code against VALID_PLAN_CODES', () => {
  assert.match(subscriptionSelectPage, /VALID_PLAN_CODES/)
})

test('Subscription select: does NOT auto-checkout on mount', () => {
  assert.doesNotMatch(subscriptionSelectPage, /selectFree\(\)/)
  assert.doesNotMatch(subscriptionSelectPage, /selectPaid\(/)
})

// ============================================================================
// GOOGLE FLOW TESTS
// ============================================================================

test('GoogleContinueButton: sets broker-intent cookie with plan before OAuth', () => {
  assert.match(googleButton, /\/api\/auth\/broker-intent/)
  assert.match(googleButton, /body.*plan/)
})

test('GoogleContinueButton: accepts plan prop', () => {
  assert.match(googleButton, /plan\?:\s*string/)
})

// ============================================================================
// COMPANY ISOLATION TESTS
// ============================================================================

test('Public subscription page does NOT use CompanyAdvertisingPlan', () => {
  assert.doesNotMatch(subscriptionPage, /CompanyAdvertisingPlan/)
  assert.doesNotMatch(subscriptionPage, /companyAdvertising/)
})

test('Public subscription API uses broker plans only', () => {
  const plansApi = read('app/api/subscription/plans/route.ts')
  assert.match(plansApi, /listBrokerPlansPublic/)
  assert.doesNotMatch(plansApi, /CompanyAdvertisingPlan/)
})

// ============================================================================
// PLAN IDENTITY CONSISTENCY
// ============================================================================

test('FEATURED internal code is preserved (not MORTGAGE_EXPERT)', () => {
  assert.match(brokerIntentLib, /'FEATURED'/)
  assert.doesNotMatch(brokerIntentLib, /'MORTGAGE_EXPERT'/)
})

test('FREE internal code is preserved', () => {
  assert.match(brokerIntentLib, /'FREE'/)
})

test('Plan codes used in redirects are FREE or FEATURED', () => {
  assert.match(subscriptionPage, /plan=FREE/)
  assert.match(subscriptionPage, /plan=FEATURED/)
})
