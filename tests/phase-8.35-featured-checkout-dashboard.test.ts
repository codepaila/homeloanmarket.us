import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')
const wizard = read('components/sections/broker/BrokerSetupWizard.tsx')
const verifyRoute = read('app/api/broker-registration/subscription/verify/route.ts')

// ===========================================================================
// PHASE 8.35 — FEATURED CHECKOUT → DASHBOARD REDIRECT
//
// After a successful FEATURED (Mortgage Expert) checkout the broker must be
// finalized automatically and redirected to /broker/dashboard — NOT sent back
// to the Review step, and NOT asked to click "Complete Profile" again.
//
// The authoritative server-side chain is preserved:
//   Stripe webhook / verify → ACTIVE registration subscription
//   → POST /api/brokers → finalizeBrokerRegistration → dashboard
// ===========================================================================

// ---------------------------------------------------------------------------
// 1. FEATURED CTA does not accidentally submit the setup form (Phase 8.32 kept)
// ---------------------------------------------------------------------------

test('8.35: the FEATURED CTA remains type="button" (never submits the setup form)', () => {
  const pricingCard = read('components/design/PricingCard.tsx')
  assert.match(pricingCard, /<motion\.button[\s\S]*?type="button"/)
})

test('8.35: FEATURED checkout creates a checkout session (existing canonical endpoint)', () => {
  const featuredEnd = wizard.indexOf('  }', wizard.indexOf('window.location.assign'))
  const featured = wizard.slice(wizard.indexOf('async function selectFeatured'), featuredEnd)
  assert.match(featured, /fetch\('\/api\/broker-registration\/subscription\/checkout'/)
  assert.match(featured, /body: JSON\.stringify\(\{ plan: 'FEATURED', priceId: plan\.stripePriceId \}\)/)
  assert.match(featured, /window\.location\.assign\(data\.url\)/)
})

// ---------------------------------------------------------------------------
// 2. Successful return: verify ACTIVE, auto-finalize, redirect to dashboard
// ---------------------------------------------------------------------------

test('8.35: verification (shared module) confirms ACTIVE and the API keeps the /setup fallback', () => {
  const verifyLib = read('lib/broker-registration-verify.ts')
  assert.match(verifyLib, /session\.status !== 'complete' \|\| session\.payment_status !== 'paid'/)
  assert.match(verifyLib, /!\[\s*'active',\s*'trialing'\s*\]\.includes\(stripeSubscription\.status\)/)
  assert.match(verifyLib, /updateRegistrationSubscriptionFromStripe/)
  assert.match(verifyLib, /Checkout session does not belong to this account/)
  // The API verify route is a thin JSON wrapper that keeps the /setup fallback
  // for compatibility (the server-side success page finalizes + redirects
  // directly and does not rely on it).
  assert.match(verifyRoute, /redirectTo: '\/setup'/)
  assert.match(verifyRoute, /verifyBrokerRegistrationCheckout/)
})

test('8.35: the wizard auto-finalizes when the subscription is ACTIVE on mount (checkout return)', () => {
  // An effect runs onSubmit() once when an ACTIVE subscription is present on
  // mount, so the broker is finalized without a Review/Complete-Profile click.
  assert.match(wizard, /const autoFinalizeAttemptedRef = useRef\(false\)/)
  assert.match(wizard, /subscription\?\.isActive && subscription\?\.status === 'ACTIVE'/)
  assert.match(wizard, /void onSubmit\(\)/)
})

test('8.35: the wizard resumes on the plan step (not Review) after an ACTIVE subscription', () => {
  // A successful checkout return persists draft.currentStep clamped to 5
  // (Review); with an ACTIVE subscription the wizard resumes on Step 6 instead,
  // so the user is not dumped back onto Review.
  assert.match(wizard, /if \(subscription\?\.isActive && subscription\?\.status === 'ACTIVE' && persisted >= 5\)\s*\{\s*return steps\.length\s*\}/)
})

test('8.35: onSubmit finalizes via POST /api/brokers and redirects to /broker/dashboard', () => {
  const onSubmit = wizard.slice(wizard.indexOf('const onSubmit'), wizard.indexOf('const autoFinalizeAttemptedRef'))
  assert.match(onSubmit, /fetch\('\/api\/brokers',\s*\{\s*method: 'POST'/)
  assert.match(onSubmit, /router\.push\('\/broker\/dashboard'\)/)
  assert.match(onSubmit, /await refreshSession\(\)/)
})

test('8.35: a duplicate/already-created broker (idempotent finalization) still reaches the dashboard', () => {
  const onSubmit = wizard.slice(wizard.indexOf('const onSubmit'), wizard.indexOf('const autoFinalizeAttemptedRef'))
  assert.match(onSubmit, /response\.status === 400 && result\.message === 'You already have a broker profile'/)
  assert.match(onSubmit, /router\.push\('\/broker\/dashboard'\)/)
})

// ---------------------------------------------------------------------------
// 3. No premature finalization before ACTIVE (server authority preserved)
// ---------------------------------------------------------------------------

test('8.35: the ACTIVE-subscription guard still blocks finalization when not ACTIVE', () => {
  const onSubmit = wizard.slice(wizard.indexOf('const onSubmit'), wizard.indexOf('const autoFinalizeAttemptedRef'))
  assert.match(onSubmit, /!\(subscription\?\.isActive && subscription\?\.status === 'ACTIVE'\) && !freeActivatedOverrideRef\.current/)
  assert.match(onSubmit, /We couldn't finish your broker setup\. Please try again\./)
})

test('8.35: FEATURED selection itself never finalizes (checkout does not equal ACTIVE)', () => {
  const featured = wizard.slice(wizard.indexOf('async function selectFeatured'), wizard.indexOf('\n  return (\n    <div className="space-y-6">'))
  assert.doesNotMatch(featured, /onFinalize|onFreeActivated|freeActivatedOverride|fetch\('\/api\/brokers'/)
})

test('8.35: auto-finalize only triggers for an ACTIVE subscription, never CHECKOUT_PENDING', () => {
  // The mount effect guards on isActive; a CHECKOUT_PENDING/FEATURED-not-active
  // state can never auto-finalize.
  const effectBlock = wizard.slice(wizard.indexOf('const autoFinalizeAttemptedRef'), wizard.indexOf('const renderStep'))
  assert.match(effectBlock, /if \(isActive && !autoFinalizeAttemptedRef\.current\)/)
  assert.doesNotMatch(effectBlock, /CHECKOUT_PENDING/)
})

// ---------------------------------------------------------------------------
// 4. Cancellation / failure: return to setup safely, no finalize
// ---------------------------------------------------------------------------

test('8.35: cancelled/failed checkout returns to /setup (no finalize)', () => {
  const checkout = read('app/api/broker-registration/subscription/checkout/route.ts')
  assert.match(checkout, /cancel_url:/)
  assert.match(checkout, /cancel_url:.*\/setup/)
  assert.doesNotMatch(checkout, /cancel_url:.*\/broker\/subscription\/select/)
})

// ---------------------------------------------------------------------------
// 5. No unnecessary requests / loading in the ordinary success flow
// ---------------------------------------------------------------------------

test('8.35: the wizard fetches plans exactly once and does not call router.refresh during FREE', () => {
  const step = wizard.slice(wizard.indexOf('function Step6PlanSelection'), wizard.indexOf('async function selectFree'))
  assert.match(step, /fetch\('\/api\/subscription\/plans'\)/)
  assert.match(step, /\}, \[\]\)/)
})

test('8.35: the FREE Phase 8.32 flow is preserved (activation override + auto-finalize)', () => {
  assert.match(wizard, /freeActivatedOverrideRef = useRef\(false\)/)
  assert.match(wizard, /freeActivatedOverrideRef\.current\s*=\s*true/)
  assert.match(wizard, /await onFinalize\(\)/)
})
