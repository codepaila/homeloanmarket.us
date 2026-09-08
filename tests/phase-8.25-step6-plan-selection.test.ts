import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')
const wizard = read('components/sections/broker/BrokerSetupWizard.tsx')
const plansRoute = read('app/api/subscription/plans/route.ts')
const freeRoute = read('app/api/broker-registration/subscription/free/route.ts')
const checkoutRoute = read('app/api/broker-registration/subscription/checkout/route.ts')
const brokersRoute = read('app/api/brokers/route.ts')
const brokerRegistration = read('lib/broker-registration.ts')
const brokerPlans = read('lib/broker-plans.ts')
const setupPage = read('app/setup/page.tsx')

const component = wizard.slice(wizard.indexOf('function Step6PlanSelection'))
const handleNext = wizard.slice(wizard.indexOf('const handleNext'), wizard.indexOf('const handleBack'))
const onSubmit = wizard.slice(wizard.indexOf('const onSubmit'), wizard.indexOf('const renderStep'))

// ===========================================================================
// PHASE 8.25 — BROKER ONBOARDING: SUBSCRIPTION PLAN IS STEP 6 OF THE WIZARD
// ===========================================================================

// ---------------------------------------------------------------------------
// 1. STEP-6 INTEGRATION (no /setup -> /broker/subscription/select loop)
// ---------------------------------------------------------------------------

test('STEP-6: plan selection is the sixth wizard step, rendered after Review', () => {
  assert.match(wizard, /{ id: 6, title: 'Plan', icon: CreditCard }/)
  assert.match(wizard, /6: \{ title: 'Subscription Plan'/)
  const renderStep = wizard.slice(wizard.indexOf('const renderStep'), wizard.indexOf('// Step 1: Basic Information'))
  assert.match(renderStep, /case 6:/)
  assert.match(renderStep, /<Step6PlanSelection/)
  assert.match(renderStep, /subscription=\{subscription\}/)
  assert.match(renderStep, /onFinalize=\{onSubmit\}/)
})

test('STEP-6: the wizard no longer redirects to /broker/subscription/select', () => {
  assert.doesNotMatch(wizard, /handleProceedToPlans/)
  assert.doesNotMatch(wizard, /\/broker\/subscription\/select/)
})

test('STEP-6: Review step always advances to Plan via Continue (no special CTA)', () => {
  const navButtons = wizard.slice(wizard.indexOf('{/* Navigation Buttons */}'), wizard.indexOf('// Step 1: Basic Information'))
  assert.match(navButtons, /currentStep < steps\.length/)
  assert.doesNotMatch(navButtons, /Proceed to Plan Selection/)
  assert.doesNotMatch(navButtons, /Complete Setup/)
  const nextController = wizard.slice(wizard.indexOf('const handleNext'), wizard.indexOf('const handleBack'))
  assert.match(nextController, /if \(currentStep < steps\.length\)/)
})

// ---------------------------------------------------------------------------
// 2. GATES: profile + location must be complete before Step 6
// ---------------------------------------------------------------------------

test('GATE: Review->Plan full-form validation with distinct profile/location toasts', () => {
  assert.match(handleNext, /case 5:/)
  assert.match(handleNext, /isValid = await form\.trigger\(\)/)
  assert.match(handleNext, /locationIncomplete/)
  assert.match(handleNext, /'Please complete your office location before choosing a plan\.'/)
  assert.match(handleNext, /'Please complete your broker profile before choosing a plan\.'/)
})

test('GATE: a validation failure never advances the step', () => {
  const invalidBlock = handleNext.slice(handleNext.indexOf('if (!isValid)'), handleNext.indexOf('if (currentStep < steps.length)'))
  assert.match(invalidBlock, /return/)
  assert.doesNotMatch(invalidBlock, /setCurrentStep/)
})

// ---------------------------------------------------------------------------
// 3. PLAN DATA — canonical plans only, prices never hardcoded
// ---------------------------------------------------------------------------

test('PLANS: Step 6 loads from GET /api/subscription/plans in an effect (no render-time fetch/state)', () => {
  assert.match(component, /fetch\('\/api\/subscription\/plans'\)/)
  assert.match(component, /useEffect/) // fetch only inside the mount effect
  // No render-time setState: the only synchronous setState calls are inside
  // the async loader / event handlers, and no state-setter runs during render.
  assert.doesNotMatch(component, /setPlans\(plans\.map/)
})

test('PLANS: the step filters strictly to FREE and FEATURED (no PREMIUM advertised)', () => {
  assert.match(component, /\['FREE', 'FEATURED'\]\.includes\(p\.code\)/)
  assert.doesNotMatch(component, /PREMIUM/)
})

test('PLANS: prices are resolved from the public plan API, never hardcoded in the step', () => {
  assert.match(component, /plan\.price \/ 100/)
  assert.doesNotMatch(component, /\$0|monthly|price=\{\d|price:\s*\d/)
})

test('PLANS: the canonical plan list exposes only DB-backed FREE/FEATURED plans', () => {
  assert.match(brokerPlans, /SUPPORTED_BROKER_PLAN_CODES = \['FREE', 'FEATURED'\]/)
  assert.match(brokerPlans, /listBrokerPlansPublic/)
  assert.match(plansRoute, /listBrokerPlansPublic/)
})

// ---------------------------------------------------------------------------
// 4. FREE FLOW
// ---------------------------------------------------------------------------

test('FREE: selecting Free POSTs the FREE endpoint then finalizes', () => {
  assert.match(component, /fetch\('\/api\/broker-registration\/subscription\/free'/)
  assert.match(component, /setFreeActivated\(true\)/)
  assert.match(component, /onFreeActivated\?\.\(\)/)
  assert.match(component, /toast\.success\('Free plan selected\. Finalizing your broker profile…'\)/)
  assert.match(component, /await onFinalize\(\)/)
})

test('FREE: selecting Free sets the parent override so finalize bypasses the stale-prop guard once', () => {
  assert.match(onSubmit, /freeActivatedOverride/)
  const guard = onSubmit.slice(onSubmit.indexOf('if (!('), onSubmit.indexOf('\n      const data'))
  assert.match(guard, /subscription\?\.isActive && subscription\?\.status === 'ACTIVE'/)
  assert.match(guard, /!freeActivatedOverride/)
  assert.match(onSubmit, /toast\.error\("We couldn't finish your broker setup\. Please try again\."\)/)
})

test('FREE: a failed FREE request shows an error and never finalizes', () => {
  const freeFn = component.slice(component.indexOf('async function selectFree'), component.indexOf('async function selectFeatured'))
  assert.match(freeFn, /if \(!response\.ok\) throw new Error/)
  assert.match(freeFn, /catch \(cause\)/)
  assert.match(freeFn, /toast\.error\(message\)/)
  const finalizeCall = freeFn.slice(freeFn.indexOf('await onFinalize()') - 200, freeFn.indexOf('await onFinalize()'))
  assert.doesNotMatch(finalizeCall, /catch/)
  assert.match(freeFn, /if \(actionLoading\) return/)
})

// ---------------------------------------------------------------------------
// 5. FEATURED FLOW
// ---------------------------------------------------------------------------

test('FEATURED: selecting Mortgage Expert POSTs checkout with the DB priceId then redirects', () => {
  assert.match(component, /fetch\('\/api\/broker-registration\/subscription\/checkout'/)
  assert.match(component, /body: JSON\.stringify\(\{ plan: 'FEATURED', priceId: plan\.stripePriceId \}\)/)
  assert.match(component, /toast\.success\('Mortgage Expert selected\. Redirecting you to secure checkout…'\)/)
  assert.match(component, /window\.location\.assign\(data\.url\)/)
})

test('FEATURED: checkout never finalizes — no onFinalize call in the FEATURED path', () => {
  const featuredFn = component.slice(component.indexOf('async function selectFeatured'), component.indexOf('return ('))
  assert.doesNotMatch(featuredFn, /onFinalize/)
  assert.doesNotMatch(featuredFn, /\/api\/brokers/)
})

test('FEATURED: a checkout failure shows the required error message and re-enables the card', () => {
  const featuredFn = component.slice(component.indexOf('async function selectFeatured'), component.indexOf('return (\n    <div className="space-y-6">'))
  assert.match(featuredFn, /data\.error \|\| "We couldn't start checkout\. Please try again\."/)
  assert.match(featuredFn, /if \(!data\.url\) throw new Error/)
  assert.match(featuredFn, /setActionLoading\(null\)/)
})

test('FEATURED: selecting a card is the explicit confirm — no checkout on mere highlight', () => {
  const cardBlock = component.slice(component.indexOf('onSelect='), component.indexOf('</PricingCard>'))
  assert.match(cardBlock, /if \(plan\.code === 'FREE'\) void selectFree\(\)\s*else void selectFeatured\(plan\)/)
  assert.doesNotMatch(cardBlock, /onMouseOver|onFocus/)
})

// ---------------------------------------------------------------------------
// 6. ACTIVE / CHECKOUT_PENDING / RESUME
// ---------------------------------------------------------------------------

test('STATE: finalize button appears ONLY for an ACTIVE subscription (or just-activated FREE)', () => {
  assert.match(component, /const canFinalize = isActive \|\| freeActivated/)
  const finalizeButton = component.slice(component.indexOf('{canFinalize && ('), component.indexOf('{!isActive && !isCheckoutPending'))
  assert.match(finalizeButton, /Complete Broker Profile/)
  assert.match(finalizeButton, /onClick=\{\(\) => void onFinalize\(\)\}/)
  assert.match(finalizeButton, /type="button"/)
  assert.doesNotMatch(component, /CHECKOUT_PENDING.*onFinalize/)
})

test('STATE: CHECKOUT_PENDING shows a resume hint and never exposes finalization', () => {
  assert.match(component, /isCheckoutPending = subscription\?\.status === 'CHECKOUT_PENDING' && !isActive/)
  assert.match(component, /to resume, or choose Free to switch plans\./)
  const pendingHint = component.slice(component.indexOf('{isCheckoutPending &&'), component.indexOf('{canFinalize &&'))
  assert.doesNotMatch(pendingHint, /onFinalize/)
  assert.doesNotMatch(pendingHint, /Complete Broker Profile/)
})

test('STATE: duplicate-click protection — actions are disabled while one is in flight', () => {
  assert.match(component, /if \(actionLoading\) return/)
  assert.match(component, /disabled=\{actionLoading !== null \|\| isSubmitting\}/)
  assert.match(component, /pointer-events-none opacity-60/)
})

// ---------------------------------------------------------------------------
// 7. BACK-SAFETY & NAVIGATION
// ---------------------------------------------------------------------------

test('BACK: going back from Step 6 only changes the step — it never creates a subscription', () => {
  assert.match(wizard, /const handleBack = \(\) => \{/)
  const backFn = wizard.slice(wizard.indexOf('const handleBack'), wizard.indexOf('const onSubmit'))
  assert.match(backFn, /setCurrentStep\(prev => prev - 1\)/)
  assert.doesNotMatch(backFn, /subscription|checkout|free/)
  // Step 6 renders no Next/Continue and no native submit button — only Back.
  const navButtons = wizard.slice(wizard.indexOf('{/* Navigation Buttons */}'), wizard.indexOf('// Step 1: Basic Information'))
  assert.match(navButtons, /currentStep < steps\.length \?/)
  assert.doesNotMatch(navButtons, /type="submit"/)
})

test('NAV: successful finalization pushes the broker to /broker/dashboard', () => {
  assert.match(onSubmit, /router\.push\('\/broker\/dashboard'\)/)
})

test('NAV: finalize success toast is exactly "Your broker profile is ready."', () => {
  assert.match(onSubmit, /toast\.success\('Your broker profile is ready\.'\)/)
})

// ---------------------------------------------------------------------------
// 8. PERSISTENCE / RESUME
// ---------------------------------------------------------------------------

test('PERSIST: advancing Review->Plan persists currentStep 6 to the onboarding draft', () => {
  const saveBlock = handleNext.slice(handleNext.indexOf('if (currentStep < steps.length)'), handleNext.indexOf('catch (error)'))
  assert.match(saveBlock, /currentStep: currentStep \+ 1/)
  assert.match(saveBlock, /\/api\/broker-registration\/onboarding/)
})

test('PERSIST: /setup restores draft.currentStep so a Stripe return resumes on Step 6', () => {
  assert.match(setupPage, /draft\?\.currentStep/)
  assert.match(setupPage, /initialStep=\{initialStep\}/)
})

// ---------------------------------------------------------------------------
// 9. ARCHITECTURE / REUSE — no duplicated plan or checkout logic
// ---------------------------------------------------------------------------

test('ARCH: Step 6 reuses the existing plan/checkout/finalize endpoints in place', () => {
  assert.match(component, /\/api\/subscription\/plans/)
  assert.match(component, /\/api\/broker-registration\/subscription\/free/)
  assert.match(component, /\/api\/broker-registration\/subscription\/checkout/)
  // POST /api/brokers (finalizeBrokerRegistration) stays the SOLE finalization
  // call, wired through the parent onSubmit — not duplicated in the step.
  assert.doesNotMatch(component, /fetch\('\/api\/brokers'/)
  assert.match(onSubmit, /fetch\('\/api\/brokers'/)
})

test('ARCH: /setup (wizard Step 6) is the sole canonical plan-selection surface', () => {
  // The legacy standalone plan-select route was removed in Phase 8.35.5;
  // plan selection lives only in the setup wizard Step 6.
  assert.match(wizard, /Step6PlanSelection/)
  assert.match(wizard, /case 6:/)
})

test('ARCH: finalizeBrokerRegistration remains the only Broker-creation path', () => {
  assert.match(brokersRoute, /createBrokerForExistingUser/)
  assert.match(brokerRegistration, /export async function finalizeBrokerRegistration/)
  assert.match(brokerRegistration, /createBrokerForExistingUser\(userId: string[\s\S]*return finalizeBrokerRegistration\(userId, data\)/)
  assert.match(brokerRegistration, /tx\.broker\.create/)
})

test('ARCH: the onboarding state machine is authoritative and untouched', () => {
  assert.match(freeRoute, /status: 'ONBOARDING_IN_PROGRESS'/)
  assert.match(freeRoute, /status: 'ACTIVE'/)
  assert.match(freeRoute, /FEATURED subscription must be managed/)
  assert.match(checkoutRoute, /CHECKOUT_PENDING/)
})