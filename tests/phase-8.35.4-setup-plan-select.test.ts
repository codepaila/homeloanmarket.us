import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')
const setupPage = read('app/setup/page.tsx')
const wizard = read('components/sections/broker/BrokerSetupWizard.tsx')
const checkoutRoute = read('app/api/broker-registration/subscription/checkout/route.ts')
const successPage = read('app/broker-registration/subscription/success/page.tsx')
const publicSubscriptionPage = read('app/(public)/subscription/page.tsx')
const stateMachine = read('lib/broker-onboarding-state.ts')

// ===========================================================================
// PHASE 8.35.4 — MIGRATE BROKER REGISTRATION PLAN-SELECT FALLBACKS TO /setup
//
// /setup is the only canonical broker-registration plan-selection UI. The legacy
// /broker/subscription/select route is retired as a registration destination:
// every remaining production landing (Stripe cancel, verification failure,
// public pricing handoff, onboarding state machine) now resolves to /setup.
// ===========================================================================

// ---------------------------------------------------------------------------
// 1. /setup?plan= support (preselect only — never bypasses steps)
// ---------------------------------------------------------------------------

test('8.35.4: /setup reads and validates an explicit plan query parameter', () => {
  assert.match(setupPage, /searchParams: Promise<\{ plan\?: string \}>/)
  assert.match(setupPage, /rawPlan === 'FREE' \|\| rawPlan === 'FEATURED' \? rawPlan : null/)
  assert.match(setupPage, /planParam=\{planParam\}/)
})

test('8.35.4: the wizard accepts planParam and preselects the card on Step 6 (FREE + FEATURED)', () => {
  assert.match(wizard, /planParam\?: string \| null/)
  assert.match(wizard, /preselectedPlan=\{planParam\}/)
  assert.match(wizard, /function Step6PlanSelection\([\s\S]*preselectedPlan/)
  assert.match(wizard, /preselectedPlan === plan\.code \? 'rounded ring-2 ring-primary\/40' : ''/)
})

test('8.35.4: ?plan= does NOT bypass required setup steps and does NOT create a subscription', () => {
  // The wizard still renders all 6 steps (profile first); the plan query only
  // highlights the intended card — selection/activation is a click.
  assert.match(wizard, /{ id: 1, title: 'Basic Profile'/)
  assert.match(wizard, /{ id: 6, title: 'Plan', icon: CreditCard }/)
  assert.match(wizard, /async function selectFree\(\)/)
  assert.match(wizard, /async function selectFeatured\(/)
  // No auto-invocation of activation from the plan param.
  assert.doesNotMatch(wizard, /preselectedPlan[\s\S]{0,120}selectFree\(\)/)
  assert.doesNotMatch(wizard, /preselectedPlan[\s\S]{0,120}selectFeatured\(/)
})

// ---------------------------------------------------------------------------
// 2. Stripe cancel flow → /setup
// ---------------------------------------------------------------------------

test('8.35.4: FEATURED registration checkout cancel_url points to /setup', () => {
  assert.match(checkoutRoute, /cancel_url:.*\/setup/)
  assert.doesNotMatch(checkoutRoute, /cancel_url:.*\/broker\/subscription\/select/)
  // Checkout authority untouched.
  assert.match(checkoutRoute, /validateBrokerPlanForCheckout/)
  assert.match(checkoutRoute, /CHECKOUT_PENDING/)
})

// ---------------------------------------------------------------------------
// 3. Registration verification failure → /setup
// ---------------------------------------------------------------------------

test('8.35.4: verification failures and invalid session recover through /setup (not the legacy select)', () => {
  assert.doesNotMatch(successPage, /broker\/subscription\/select/)
  assert.match(successPage, /redirect\('\/setup'\)/)
  // The successful path still finalizes and goes straight to the dashboard.
  assert.match(successPage, /finalizeBrokerRegistration\(user\.id\)/)
  assert.match(successPage, /redirect\('\/broker\/dashboard'\)/)
})

// ---------------------------------------------------------------------------
// 4. Public subscription handoff → /setup?plan= (new broker) / /broker/subscription (existing)
// ---------------------------------------------------------------------------

test('8.35.4: public pricing hands a new broker to /setup?plan= and preserves the plan', () => {
  assert.match(publicSubscriptionPage, /\/setup\?plan=\$\{code\}/)
  assert.doesNotMatch(publicSubscriptionPage, /\/broker\/subscription\/select\?plan=/)
})

test('8.35.4: public pricing routes an already-finalized existing broker to /broker/subscription', () => {
  assert.match(publicSubscriptionPage, /role === 'BROKER' && !hasBrokerProfile/)
  assert.match(publicSubscriptionPage, /role === 'BROKER' && hasBrokerProfile/)
  assert.match(publicSubscriptionPage, /'\/broker\/subscription'/)
})

// ---------------------------------------------------------------------------
// 5. Onboarding state machine — legacy select retired to /setup
// ---------------------------------------------------------------------------

test('8.35.4: the onboarding state machine no longer permits /broker/subscription/select', () => {
  assert.doesNotMatch(stateMachine, /\/broker\/subscription\/select/)
  assert.match(stateMachine, /return currentPath === '\/setup' \? null : '\/setup'/)
})

// ---------------------------------------------------------------------------
// 6. No production registration flow requires /broker/subscription/select
// ---------------------------------------------------------------------------

test('8.35.4: no production registration flow requires /broker/subscription/select', () => {
  const productionFiles = [
    'app/setup/page.tsx',
    'components/sections/broker/BrokerSetupWizard.tsx',
    'app/api/broker-registration/subscription/checkout/route.ts',
    'app/broker-registration/subscription/success/page.tsx',
    'app/(public)/subscription/page.tsx',
    'lib/broker-onboarding-state.ts',
    'app/api/broker-registration/subscription/verify/route.ts',
  ]
  for (const file of productionFiles) {
    assert.doesNotMatch(read(file), /broker\/subscription\/select/, `${file} must not reference the legacy select route`)
  }
})

// ---------------------------------------------------------------------------
// 7. Phase 8.35/8.35.1 finalization + FREE/FEATURED lifecycle preserved
// ---------------------------------------------------------------------------

test('8.35.4: FREE/FEATURED lifecycle and finalization remain intact', () => {
  // FREE activation override + auto-finalize recovery preserved.
  assert.match(wizard, /freeActivatedOverrideRef = useRef\(false\)/)
  assert.match(wizard, /await onFinalize\(\)/)
  assert.match(wizard, /const autoFinalizeAttemptedRef = useRef\(false\)/)
  // FEATURED checkout never finalizes before ACTIVE.
  const featured = wizard.slice(wizard.indexOf('async function selectFeatured'), wizard.indexOf('  }', wizard.indexOf('window.location.assign')))
  assert.doesNotMatch(featured, /onFinalize|onFreeActivated|freeActivatedOverride/)
  // Shared verification remains authoritative.
  assert.match(read('lib/broker-registration-verify.ts'), /updateRegistrationSubscriptionFromStripe/)
})