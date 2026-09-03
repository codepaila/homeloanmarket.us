import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')

// ---------------------------------------------------------------------------
// BROKER INTENT COOKIE — backward compatibility & plan support
// ---------------------------------------------------------------------------

test('broker-intent library exports plan-aware helpers', () => {
  const src = read('lib/broker-intent.ts')
  assert.match(src, /export function brokerIntentValue/)
  assert.match(src, /export async function hasBrokerRegistrationIntent/)
  assert.match(src, /export async function getBrokerRegistrationIntentPlan/)
  assert.match(src, /SUPPORTED_BROKER_PLAN_CODES/)
  assert.match(src, /parseBrokerIntentCookie/)
})

test('broker-intent supports legacy raw HMAC cookies', () => {
  const src = read('lib/broker-intent.ts')
  // The parser must handle a raw HMAC string (no JSON wrapper)
  assert.match(src, /try \{/)
  assert.match(src, /JSON\.parse\(value\)/)
  assert.match(src, /catch/)
  // On parse failure, the raw value is treated as the signature
  assert.match(src, /sig: value/)
})

test('broker-intent validates plan against supported codes only', () => {
  const src = read('lib/broker-intent.ts')
  const plansSrc = read('lib/broker-plans.ts')
  // broker-intent reuses the single canonical supported-codes source from
  // broker-plans instead of duplicating the list.
  assert.match(src, /SUPPORTED_BROKER_PLAN_CODES/)
  assert.match(src, /from '@\/lib\/broker-plans'/)
  assert.match(plansSrc, /SUPPORTED_BROKER_PLAN_CODES = \['FREE', 'FEATURED'\] as const/)
  assert.match(src, /isValidPlan/)
  // Only FREE and FEATURED are in the supported codes list (exact match above).
})

test('broker-intent API accepts optional plan in POST body', () => {
  const src = read('app/api/auth/broker-intent/route.ts')
  assert.match(src, /POST/)
  assert.match(src, /body\.plan/)
  assert.match(src, /'FREE'/)
  assert.match(src, /'FEATURED'/)
  // Same-origin protection preserved
  assert.match(src, /isSameOriginRequest/)
  // Cookie properties preserved
  assert.match(src, /httpOnly: true/)
  assert.match(src, /sameSite: 'lax'/)
  assert.match(src, /maxAge: 15 \* 60/)
})

test('broker-intent PUT returns plan in redirect URL', () => {
  const src = read('app/api/auth/broker-intent/route.ts')
  assert.match(src, /getBrokerRegistrationIntentPlan/)
  assert.match(src, /\?plan=/)
  assert.match(src, /redirectTo/)
  // Cookie is deleted after establishment
  assert.match(src, /cookies\.delete\(BROKER_INTENT_COOKIE\)/)
})

// ---------------------------------------------------------------------------
// SIGNUP PAGE — reads plan from URL
// ---------------------------------------------------------------------------

test('signup page reads plan from URL search params', () => {
  const src = read('app/(public)/auth/signup/page.tsx')
  assert.match(src, /useSearchParams/)
  assert.match(src, /searchParams\.get\('plan'\)/)
  assert.match(src, /VALID_PLAN_CODES/)
  assert.match(src, /'FREE'/)
  assert.match(src, /'FEATURED'/)
})

test('signup page passes plan to GoogleContinueButton', () => {
  const src = read('app/(public)/auth/signup/page.tsx')
  assert.match(src, /GoogleContinueButton/)
  assert.match(src, /plan=\{validPlan\}/)
})

test('signup page appends plan to email registration redirect', () => {
  const src = read('app/(public)/auth/signup/page.tsx')
  assert.match(src, /validPlan/)
  assert.match(src, /separator.*plan=/)
  assert.match(src, /router\.push\(redirectTo\)/)
})

test('signup page is wrapped in Suspense for useSearchParams', () => {
  const src = read('app/(public)/auth/signup/page.tsx')
  assert.match(src, /<Suspense/)
  assert.match(src, /BrokerSignupForm/)
})

// ---------------------------------------------------------------------------
// GOOGLE BUTTON — sends plan to broker-intent
// ---------------------------------------------------------------------------

test('GoogleContinueButton accepts plan prop and sends it to broker-intent', () => {
  const src = read('components/auth/GoogleContinueButton.tsx')
  assert.match(src, /plan\?: string \| null/)
  assert.match(src, /broker-intent/)
  // Plan is conditionally sent in request body
  assert.match(src, /body\.plan/)
  assert.match(src, /'FREE'/)
  assert.match(src, /'FEATURED'/)
})

test('GoogleContinueButton appends plan to OAuth callback URL', () => {
  const src = read('components/auth/GoogleContinueButton.tsx')
  assert.match(src, /oauthCallback/)
  assert.match(src, /\?plan=/)
  assert.match(src, /signIn\('google'/)
})

// ---------------------------------------------------------------------------
// EMAIL VERIFICATION — preserves plan through redirect
// ---------------------------------------------------------------------------

test('verify-email API reads plan from request body and preserves in redirect', () => {
  const src = read('app/api/auth/verify-email/route.ts')
  assert.match(src, /plan: rawPlan/)
  assert.match(src, /sanitizePlan/)
  assert.match(src, /VALID_PLAN_CODES/)
  assert.match(src, /appendPlanToRedirect/)
  // Plan validation
  assert.match(src, /'FREE'/)
  assert.match(src, /'FEATURED'/)
})

test('verify-email API preserves existing redirect semantics', () => {
  const src = read('app/api/auth/verify-email/route.ts')
  // Broker registration redirect
  assert.match(src, /updatedUser\.brokerRegistration\?\.id/)
  assert.match(src, /\/broker\/subscription\/select/)
  // Claim context redirect
  assert.match(src, /\/claim-broker\/continue/)
  // Company redirect
  assert.match(src, /\/company\/subscription\/select/)
  // Default redirect
  assert.match(src, /redirectTo: appendPlanToRedirect\(baseRedirect, plan\)/)
})

test('verify-email page passes plan to verification API', () => {
  const src = read('app/(public)/auth/verify-email/page.tsx')
  assert.match(src, /searchParams\.get\('plan'\)/)
  assert.match(src, /body\.plan/)
  assert.match(src, /VALID_PLAN_CODES/)
})

// ---------------------------------------------------------------------------
// BROKER REGISTRATION CONTINUE — passes plan through
// ---------------------------------------------------------------------------

test('broker-registration continue page delegates plan to server-side intent', () => {
  const src = read('app/broker-registration/continue/page.tsx')
  // The page calls PUT broker-intent; the server reads the plan from the cookie
  assert.match(src, /broker-intent/)
  assert.match(src, /refreshSession/)
  // No client-side searchParams needed — plan is read from the HMAC cookie server-side
  assert.doesNotMatch(src, /useSearchParams/)
})

// ---------------------------------------------------------------------------
// SUBSCRIPTION SELECT PAGE — visual preselection
// ---------------------------------------------------------------------------

test('subscription select page reads plan from URL', () => {
  const src = read('app/broker/subscription/select/page.tsx')
  assert.match(src, /useSearchParams/)
  assert.match(src, /searchParams\.get\('plan'\)/)
  assert.match(src, /VALID_PLAN_CODES/)
  assert.match(src, /'FREE'/)
  assert.match(src, /'FEATURED'/)
})

test('subscription select page only preselects valid active plans', () => {
  const src = read('app/broker/subscription/select/page.tsx')
  assert.match(src, /p\.isActive/)
  assert.match(src, /selectedPlanCode/)
  // No auto-submission — selection is visual only
  assert.doesNotMatch(src, /auto.*select|auto.*submit|setTimeout.*select/)
})

test('subscription select page wraps content in Suspense', () => {
  const src = read('app/broker/subscription/select/page.tsx')
  assert.match(src, /<Suspense/)
  assert.match(src, /SubscriptionSelectContent/)
})

test('subscription select page highlights preselected plan card', () => {
  const src = read('app/broker/subscription/select/page.tsx')
  assert.match(src, /ring-2 ring-primary\/40/)
  assert.match(src, /selectedPlanCode === plan\.code/)
  // Plans are wrapped in a div for styling
  assert.match(src, /<div[^>]*key=\{plan\.id\}/)
})

test('subscription select page preserves existing CTA behavior', () => {
  const src = read('app/broker/subscription/select/page.tsx')
  // FREE handler
  assert.match(src, /selectFree/)
  assert.match(src, /\/api\/broker-registration\/subscription\/free/)
  // Paid handler
  assert.match(src, /selectPaid/)
  assert.match(src, /\/api\/broker-registration\/subscription\/checkout/)
  // PricingCard onSelect is wired
  assert.match(src, /onSelect/)
})

// ---------------------------------------------------------------------------
// SECURITY — plan is only intent, never authoritative
// ---------------------------------------------------------------------------

test('broker-intent plan never contains Stripe Price ID or price', () => {
  const intentSrc = read('lib/broker-intent.ts')
  const routeSrc = read('app/api/auth/broker-intent/route.ts')
  const checkoutSrc = read('app/api/broker-registration/subscription/checkout/route.ts')
  const freeSrc = read('app/api/broker-registration/subscription/free/route.ts')

  // Intent module and route should not reference Stripe price IDs
  assert.doesNotMatch(intentSrc, /stripePriceId|price_id|priceId/i)
  assert.doesNotMatch(routeSrc, /stripePriceId|price_id|priceId/i)

  // Checkout API validates plan from DB, not from cookie/URL
  assert.match(checkoutSrc, /validateBrokerPlanForCheckout/)
  assert.match(checkoutSrc, /checkoutPlan\.plan\.stripePriceId/)

  // FREE API hardcodes plan, no client input
  assert.match(freeSrc, /plan: 'FREE'/)
})

test('subscription checkout validates plan from database not client input', () => {
  const src = read('app/api/broker-registration/subscription/checkout/route.ts')
  // Server-side plan validation
  assert.match(src, /validateBrokerPlanForCheckout/)
  assert.match(src, /plan: 'FEATURED'/)
  // Price comes from DB
  assert.match(src, /checkoutPlan\.plan\.stripePriceId/)
  // Client priceId is validated against DB, not trusted
  assert.match(src, /priceId/)
})

// ---------------------------------------------------------------------------
// EXISTING BEHAVIOR PRESERVATION
// ---------------------------------------------------------------------------

test('broker-intent signature is HMAC-based and AUTH_SECRET-dependent', () => {
  const src = read('lib/broker-intent.ts')
  assert.match(src, /crypto\.createHmac\('sha256'/)
  assert.match(src, /process\.env\.AUTH_SECRET/)
  assert.match(src, /broker-registration-intent/)
})

test('registration page does not create duplicate broker registration', () => {
  const src = read('app/api/auth/register/broker/route.ts')
  assert.match(src, /createBrokerRegistration/)
  assert.doesNotMatch(src, /createBrokerAccount/)
})

test('broker onboarding state machine is unchanged', () => {
  const src = read('lib/broker-onboarding-state.ts')
  assert.match(src, /SUBSCRIPTION_PENDING/)
  assert.match(src, /\/broker\/subscription\/select/)
  assert.match(src, /ONBOARDING_IN_PROGRESS/)
  assert.match(src, /\/setup/)
  assert.match(src, /COMPLETED/)
  assert.match(src, /\/broker\/dashboard/)
})
