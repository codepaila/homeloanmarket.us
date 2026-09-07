import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {
  getBrokerOnboardingStatus,
  isBrokerSetupComplete,
  resolveBrokerOnboardingDestination,
} from '../lib/broker-onboarding-state'
import {
  hasPaidEntitlement,
  hasActiveEntitlement,
  isMortgageExpertBroker,
} from '../lib/broker-policy'

const read = (path: string) => fs.readFileSync(path, 'utf8')

const schema = read('prisma/schema.prisma')
const onboardingStateLib = read('lib/broker-onboarding-state.ts')
const brokerRegLib = read('lib/broker-registration.ts')
const brokerIntentLib = read('lib/broker-intent.ts')
const brokerPlansLib = read('lib/broker-plans.ts')
const brokerPolicyLib = read('lib/broker-policy.ts')
const subscriptionLib = read('lib/subscription.ts')
const setupPage = read('app/setup/page.tsx')
const setupWizard = read('components/sections/broker/BrokerSetupWizard.tsx')
const selectPlanPage = read('app/broker/subscription/select/page.tsx')
const freeEndpoint = read('app/api/broker-registration/subscription/free/route.ts')
const checkoutEndpoint = read('app/api/broker-registration/subscription/checkout/route.ts')
const verifyEndpoint = read('app/api/broker-registration/subscription/verify/route.ts')
const draftEndpoint = read('app/api/broker-registration/onboarding/route.ts')
const brokersEndpoint = read('app/api/brokers/route.ts')
const webhookRoute = read('app/api/stripe/webhook/route.ts')
const verifyEmailRoute = read('app/api/auth/verify-email/route.ts')
const brokerIntentRoute = read('app/api/auth/broker-intent/route.ts')
const brokerDashboardPage = read('app/broker/dashboard/page.tsx')

// ===========================================================================
// 1. CANONICAL STATE MACHINE & DESTINATION RESOLUTION
// ===========================================================================

test('state machine: new broker with no profile stays on /setup for profile preparation', () => {
  const user = {
    role: 'BROKER',
    brokerProfile: null,
    brokerRegistration: { subscription: null },
  }
  assert.equal(getBrokerOnboardingStatus(user), 'SUBSCRIPTION_PENDING')
  assert.equal(resolveBrokerOnboardingDestination(user, '/setup'), null, 'stays on /setup')
  assert.equal(resolveBrokerOnboardingDestination(user, '/broker/subscription/select'), null, 'allowed on plan select')
  assert.equal(resolveBrokerOnboardingDestination(user, '/broker/dashboard'), '/setup', 'gated away from dashboard')
})

test('state machine: broker with CHECKOUT_PENDING stays on /setup or plan select, gated from dashboard', () => {
  const user = {
    role: 'BROKER',
    brokerProfile: null,
    brokerRegistration: { subscription: { status: 'CHECKOUT_PENDING', isActive: false } },
  }
  assert.equal(getBrokerOnboardingStatus(user), 'SUBSCRIPTION_PENDING')
  assert.equal(resolveBrokerOnboardingDestination(user, '/setup'), null)
  assert.equal(resolveBrokerOnboardingDestination(user, '/broker/subscription/select'), null)
  assert.equal(resolveBrokerOnboardingDestination(user, '/broker/dashboard'), '/setup')
})

test('state machine: completed broker goes directly to /broker/dashboard', () => {
  const user = {
    role: 'BROKER',
    brokerProfile: { id: 'broker_123' },
    brokerRegistration: { subscription: { status: 'ACTIVE', isActive: true } },
  }
  assert.equal(isBrokerSetupComplete(user), true)
  assert.equal(getBrokerOnboardingStatus(user), 'COMPLETED')
  assert.equal(resolveBrokerOnboardingDestination(user, '/setup'), '/broker/dashboard')
  assert.equal(resolveBrokerOnboardingDestination(user, '/broker/subscription/select'), '/broker/dashboard')
  assert.equal(resolveBrokerOnboardingDestination(user, '/broker/dashboard'), null)
})

test('state machine: unauthenticated users redirect to /auth/signin', () => {
  assert.equal(resolveBrokerOnboardingDestination(null, '/setup'), '/auth/signin')
  assert.equal(resolveBrokerOnboardingDestination(undefined, '/broker/dashboard'), '/auth/signin')
})

test('state machine: no redirect loop between /setup and /broker/dashboard', () => {
  const testUsers = [
    { role: 'BROKER', brokerProfile: null, brokerRegistration: null },
    { role: 'BROKER', brokerProfile: null, brokerRegistration: { subscription: null } },
    { role: 'BROKER', brokerProfile: null, brokerRegistration: { subscription: { status: 'CHECKOUT_PENDING', isActive: false } } },
    { role: 'BROKER', brokerProfile: null, brokerRegistration: { subscription: { status: 'ACTIVE', isActive: true } } },
    { role: 'BROKER', brokerProfile: { id: 'b1' }, brokerRegistration: null },
    { role: 'BROKER', brokerProfile: { id: 'b1' }, brokerRegistration: { subscription: { status: 'ACTIVE', isActive: true } } },
  ]
  for (const u of testUsers) {
    const fromSetup = resolveBrokerOnboardingDestination(u, '/setup')
    const fromDash = resolveBrokerOnboardingDestination(u, '/broker/dashboard')
    if (fromSetup === '/broker/dashboard') {
      assert.notEqual(fromDash, '/setup')
    }
    if (fromDash === '/setup') {
      assert.notEqual(fromSetup, '/broker/dashboard')
    }
  }
})

test('redirect matrix: every subscription state routes to the canonical destination', () => {
  // A. NO SUBSCRIPTION -> subscription selection reachable, dashboard gated
  const noSub = { role: 'BROKER', brokerProfile: null, brokerRegistration: { subscription: null } }
  assert.equal(getBrokerOnboardingStatus(noSub), 'SUBSCRIPTION_PENDING')
  assert.equal(resolveBrokerOnboardingDestination(noSub, '/broker/subscription/select'), null)
  assert.equal(resolveBrokerOnboardingDestination(noSub, '/broker/dashboard'), '/setup')

  // B. FREE ACTIVE -> setup/profile
  const freeActive = { role: 'BROKER', brokerProfile: null, brokerRegistration: { subscription: { status: 'ACTIVE', isActive: true, plan: 'FREE' } } }
  assert.equal(getBrokerOnboardingStatus(freeActive), 'ONBOARDING_IN_PROGRESS')
  assert.equal(resolveBrokerOnboardingDestination(freeActive, '/broker/dashboard'), '/setup')
  assert.equal(resolveBrokerOnboardingDestination(freeActive, '/setup'), null)

  // C. FEATURED CHECKOUT_PENDING -> can never appear as a completed broker
  const featuredPending = { role: 'BROKER', brokerProfile: null, brokerRegistration: { subscription: { status: 'CHECKOUT_PENDING', isActive: false, plan: 'FEATURED' } } }
  assert.equal(getBrokerOnboardingStatus(featuredPending), 'SUBSCRIPTION_PENDING')
  assert.equal(isBrokerSetupComplete(featuredPending), false)
  assert.equal(resolveBrokerOnboardingDestination(featuredPending, '/broker/subscription/select'), null)
  assert.equal(resolveBrokerOnboardingDestination(featuredPending, '/broker/dashboard'), '/setup')

  // D. FEATURED ACTIVE -> setup/profile
  const featuredActive = { role: 'BROKER', brokerProfile: null, brokerRegistration: { subscription: { status: 'ACTIVE', isActive: true, plan: 'FEATURED' } } }
  assert.equal(getBrokerOnboardingStatus(featuredActive), 'ONBOARDING_IN_PROGRESS')
  assert.equal(resolveBrokerOnboardingDestination(featuredActive, '/broker/dashboard'), '/setup')
  assert.equal(resolveBrokerOnboardingDestination(featuredActive, '/setup'), null)

  // E. COMPLETED -> final Broker / dashboard
  const completed = { role: 'BROKER', brokerProfile: { id: 'b1' }, brokerRegistration: { subscription: { status: 'ACTIVE', isActive: true } } }
  assert.equal(getBrokerOnboardingStatus(completed), 'COMPLETED')
  assert.equal(resolveBrokerOnboardingDestination(completed, '/setup'), '/broker/dashboard')
  assert.equal(resolveBrokerOnboardingDestination(completed, '/broker/dashboard'), null)
})

// ===========================================================================
// 2. REGISTRATION & VERIFICATION ENTRYPOINTS
// ===========================================================================

test('email verification redirects verified new broker to /setup', () => {
  assert.match(verifyEmailRoute, /updatedUser\.brokerRegistration\?\.id \? '\/setup'/)
  assert.match(verifyEmailRoute, /redirectTo: appendPlanToRedirect\(baseRedirect, plan\)/)
})

test('Google OAuth intent continuation redirects new broker to /setup', () => {
  assert.match(brokerIntentRoute, /let redirectTo = result\.alreadyBroker \? '\/broker\/dashboard' : '\/setup'/)
  assert.match(brokerIntentRoute, /redirectTo \+= `\?plan=\${intentPlan}`/)
})

// ===========================================================================
// 2b. REGISTRATION INTENT (EMAIL + GOOGLE PARITY)
// ===========================================================================

test('email registration creates a BrokerRegistration with SUBSCRIPTION_PENDING, never a Broker', () => {
  assert.match(brokerRegLib, /status: 'SUBSCRIPTION_PENDING'/)
  assert.match(brokerRegLib, /draft: \{\s*create: \{\s*data: \{\},\s*currentStep: 1/)
  assert.match(brokerRegLib, /ACCOUNT_ALREADY_REGISTERED/)
  assert.match(brokerRegLib, /DuplicateAccountError/)
})

test('Google broker intent establishes BrokerRegistration idempotently without charging', () => {
  assert.match(brokerIntentLib, /status: 'SUBSCRIPTION_PENDING'/)
  assert.match(brokerIntentLib, /existingRegistration/)
  assert.match(brokerIntentLib, /alreadyBroker: false as const/)
  // Intent only preselects a plan; it must never create a checkout or charge.
  assert.doesNotMatch(brokerIntentLib, /checkout\.sessions|stripe\.customers|subscriptions\.create/)
})

test('duplicate registration is idempotent and never creates a second BrokerRegistration', () => {
  assert.match(brokerRegLib, /findUnique\(\{\s*where: \{ email: normalized\.email/)
  assert.match(brokerRegLib, /ACCOUNT_ALREADY_REGISTERED/)
  assert.match(brokerIntentLib, /existingRegistration/)
  assert.match(brokerIntentLib, /alreadyBroker: true as const/)
})

// ===========================================================================
// 3. /SETUP PROFILE PREPARATION & DRAFT PERSISTENCE
// ===========================================================================

test('draft PATCH endpoint allows saving progress before subscription is active', () => {
  assert.doesNotMatch(draftEndpoint, /Subscription selection is required first|subscription\?\.status !== 'ACTIVE'/)
  assert.match(draftEndpoint, /brokerOnboardingDraft\.upsert/)
  assert.match(draftEndpoint, /status: 'ONBOARDING_IN_PROGRESS'/)
})

test('/setup wizard saves draft on Step 4 and integrates plan selection as Step 6 (no /broker/subscription/select redirect)', () => {
  // Plan selection is now the final wizard step; the wizard must NOT navigate
  // the broker out to /broker/subscription/select and back.
  assert.match(setupWizard, /Step6PlanSelection/)
  assert.match(setupWizard, /{ id: 6, title: 'Plan', icon: CreditCard }/)
  assert.doesNotMatch(setupWizard, /handleProceedToPlans/)
  assert.doesNotMatch(setupWizard, /router\.push\('\/broker\/subscription\/select'\)/)
})

// ===========================================================================
// 4. PLAN SELECTION UX & ENDPOINTS
// ===========================================================================

test('plan selection page communicates Free and Mortgage Expert choices without buy/upgrade labels', () => {
  assert.match(selectPlanPage, /Choose your broker plan/)
  assert.match(selectPlanPage, /PricingCard/)
  assert.match(selectPlanPage, /selectFree/)
  assert.match(selectPlanPage, /selectPaid/)
  assert.doesNotMatch(selectPlanPage, /Upgrade Now|Create Account|Buy Now/)
})

test('FREE endpoint activates the registration subscription without Stripe and never creates a Broker', () => {
  // FREE selection only establishes the local registration subscription
  // (plan=FREE, status=ACTIVE, isActive=true) with no Stripe objects. The final
  // Broker is created later by profile submission via finalizeBrokerRegistration
  // (POST /api/brokers), never by a subscription-selection endpoint.
  assert.doesNotMatch(freeEndpoint, /stripe\.checkout|new Stripe/)
  assert.match(freeEndpoint, /plan: 'FREE', status: 'ACTIVE', isActive: true/)
  assert.doesNotMatch(freeEndpoint, /finalizeBrokerRegistration/)
  assert.doesNotMatch(freeEndpoint, /createBrokerForExistingUser/)
  assert.doesNotMatch(freeEndpoint, /broker\.create/)
  assert.match(freeEndpoint, /redirectTo: result\.redirectTo/)
  assert.match(freeEndpoint, /redirectTo: '\/setup'/)
})

test('FEATURED checkout endpoint uses server-authoritative DB plan and Stripe price', () => {
  assert.match(checkoutEndpoint, /validateBrokerPlanForCheckout/)
  assert.match(checkoutEndpoint, /ownerType: 'BROKER_REGISTRATION'/)
  assert.match(checkoutEndpoint, /plan !== 'FEATURED'/)
})

// ===========================================================================
// 4b. PLAN IDENTIFIERS & NEGATIVE PLAN HANDLING
// ===========================================================================

test('plan selection sends plan.code, never plan.name (Mortgage Expert is display-only)', () => {
  assert.match(selectPlanPage, /if \(plan\.code === 'FREE'\)/)
  assert.match(selectPlanPage, /selectPaid\(plan\.code, priceId\)/)
  assert.match(selectPlanPage, /plan\.code === 'FEATURED'/)
  // The customer-facing name is only a display label; the internal code is
  // what the API receives. "Mortgage Expert" must never reach an API as a plan.
  assert.match(brokerPlansLib, /FEATURED: 'Mortgage Expert'/)
  assert.doesNotMatch(freeEndpoint, /Mortgage Expert/)
  assert.doesNotMatch(checkoutEndpoint, /Mortgage Expert/)
})

test('invalid plans, PREMIUM, and display names are rejected at the API boundary', () => {
  assert.match(checkoutEndpoint, /plan !== 'FEATURED'/)
  assert.match(checkoutEndpoint, /Invalid subscription plan or price/)
  // Only FREE and FEATURED are supported internal codes.
  assert.match(brokerPlansLib, /SUPPORTED_BROKER_PLAN_CODES = \['FREE', 'FEATURED'\] as const/)
  assert.match(brokerPlansLib, /BROKER_PLAN_DISPLAY_NAME: Record<string, string>/)
})

test('FREE is never a prerequisite for FEATURED and no FREE subscription is created by checkout', () => {
  assert.doesNotMatch(checkoutEndpoint, /plan: 'FREE'/)
  assert.doesNotMatch(checkoutEndpoint, /status: 'ACTIVE'/)
  assert.match(checkoutEndpoint, /status: 'CHECKOUT_PENDING'/)
  assert.doesNotMatch(freeEndpoint, /status: 'CHECKOUT_PENDING'/)
})

// ===========================================================================
// 5. CANONICAL PROFILE FINALIZATION SERVICE
// ===========================================================================

test('finalizeBrokerRegistration is the single canonical broker finalization function', () => {
  assert.match(brokerRegLib, /export async function finalizeBrokerRegistration/)
  assert.match(brokerRegLib, /createBrokerForExistingUser/)
  assert.match(brokerRegLib, /creationSource: 'SELF_REGISTERED'/)
  assert.match(brokerRegLib, /verificationStatus: 'UNVERIFIED'/)
  assert.match(brokerRegLib, /status: 'COMPLETED'/)
})

test('finalizeBrokerRegistration is idempotent and safely returns existing broker', () => {
  assert.match(brokerRegLib, /const existing = await tx\.broker\.findFirst/)
  assert.match(brokerRegLib, /if \(existing\) \{\s*return existing\s*\}/)
})

test('profile submission (POST /api/brokers) is the ONE canonical finalization path', () => {
  // The only production caller of finalization is the profile-submit route.
  assert.match(brokersEndpoint, /createBrokerForExistingUser/)
  // No subscription/checkout/verify/webhook layer may create the final Broker.
  assert.doesNotMatch(freeEndpoint, /finalizeBrokerRegistration/)
  assert.doesNotMatch(checkoutEndpoint, /finalizeBrokerRegistration/)
  assert.doesNotMatch(verifyEndpoint, /finalizeBrokerRegistration/)
  assert.doesNotMatch(webhookRoute, /finalizeBrokerRegistration/)
  // The profile-submit route enforces an ACTIVE registration subscription.
  assert.match(brokersEndpoint, /subscription\?\.status !== 'ACTIVE'/)
})

test('CHECKOUT_PENDING and non-ACTIVE subscriptions cannot finalize a Broker', () => {
  assert.match(brokerRegLib, /selectedSubscription\.status !== 'ACTIVE'/)
  assert.match(brokerRegLib, /BrokerSubscriptionRequiredError/)
  assert.match(brokerRegLib, /An active broker subscription is required before onboarding/)
  // FEATURED checkout only ever establishes CHECKOUT_PENDING.
  assert.match(checkoutEndpoint, /status: 'CHECKOUT_PENDING'/)
})

test('incomplete profile cannot finalize a Broker', () => {
  assert.match(brokerRegLib, /Display name must be at least 2 characters/)
  assert.match(brokerRegLib, /Phone number must be at least 7 digits/)
  assert.match(brokerRegLib, /Description must be at least 20 characters/)
  assert.match(brokerRegLib, /NMLS ID must be/)
  assert.match(brokerRegLib, /Select at least one licensed state/)
})

test('BrokerRegistrationSubscription owns billing before finalization; BrokerSubscription owns it after', () => {
  // Registration subscription is created by plan selection, never by finalization.
  assert.doesNotMatch(freeEndpoint, /broker\.create/)
  assert.doesNotMatch(checkoutEndpoint, /broker\.create/)
  // Finalization transfers ownership to the BrokerSubscription, preserving the
  // registration plan, dates, and Stripe identifiers.
  assert.match(brokerRegLib, /subscription: \{\s*create: \{/)
  assert.match(brokerRegLib, /plan: selectedSubscription\.plan/)
  assert.match(brokerRegLib, /stripeCustomerId: selectedSubscription\.stripeCustomerId/)
  assert.match(brokerRegLib, /stripeSubId: selectedSubscription\.stripeSubId/)
  assert.match(brokerRegLib, /data: \{ status: 'COMPLETED' \}/)
})

test('FREE lifecycle: select -> ACTIVE -> setup -> profile submit -> Broker + FREE BrokerSubscription', () => {
  // 1. Registration starts SUBSCRIPTION_PENDING.
  assert.match(brokerRegLib, /status: 'SUBSCRIPTION_PENDING'/)
  // 2. FREE selection activates the registration subscription locally with no
  //    Stripe customer/subscription.
  assert.match(freeEndpoint, /plan: 'FREE', status: 'ACTIVE', isActive: true/)
  assert.match(freeEndpoint, /stripeSubId: null, stripeCustomerId: null/)
  assert.doesNotMatch(freeEndpoint, /stripe\.checkout|new Stripe/)
  // 3. Setup is reachable for an ACTIVE subscription.
  const activeUser = { role: 'BROKER', brokerProfile: null, brokerRegistration: { subscription: { status: 'ACTIVE', isActive: true, plan: 'FREE' } } }
  assert.equal(resolveBrokerOnboardingDestination(activeUser, '/setup'), null)
  // 4. Finalization attaches the selected FREE plan to the BrokerSubscription
  //    exactly once and marks the registration COMPLETED.
  assert.match(brokerRegLib, /plan: selectedSubscription\.plan/)
  assert.match(brokerRegLib, /data: \{ status: 'COMPLETED' \}/)
  assert.match(brokerRegLib, /if \(existing\) \{\s*return existing\s*\}/)
})

// ===========================================================================
// 6. MORTGAGE EXPERT BADGE & ENTITLEMENT
// ===========================================================================

test('Mortgage Expert badge is granted ONLY to active FEATURED plans or admin override', () => {
  // FREE plan
  const freeSub = { plan: 'FREE', isActive: true, endDate: null }
  assert.equal(hasPaidEntitlement(freeSub), false)
  assert.equal(isMortgageExpertBroker({ profileBadge: hasPaidEntitlement(freeSub), mortgageExpertEnabled: false }), false)

  // FEATURED pending (not active)
  const pendingFeaturedSub = { plan: 'FEATURED', isActive: false, endDate: null }
  assert.equal(hasPaidEntitlement(pendingFeaturedSub), false)
  assert.equal(isMortgageExpertBroker({ profileBadge: hasPaidEntitlement(pendingFeaturedSub), mortgageExpertEnabled: false }), false)

  // FEATURED ACTIVE
  const activeFeaturedSub = { plan: 'FEATURED', isActive: true, endDate: null }
  assert.equal(hasPaidEntitlement(activeFeaturedSub), true)
  assert.equal(isMortgageExpertBroker({ profileBadge: hasPaidEntitlement(activeFeaturedSub), mortgageExpertEnabled: false }), true)

  // Admin override on FREE
  assert.equal(isMortgageExpertBroker({ profileBadge: false, mortgageExpertEnabled: true }), true)
})

// ===========================================================================
// 7. STRIPE WEBHOOK & ABANDONED CHECKOUT RECONCILIATION
// ===========================================================================

test('webhook handles checkout.session.expired for BROKER_REGISTRATION', () => {
  assert.match(webhookRoute, /reconcileBrokerRegistrationCheckoutExpired/)
  assert.match(subscriptionLib, /static async reconcileBrokerRegistrationCheckoutExpired/)
  assert.match(subscriptionLib, /existing\.status !== 'CHECKOUT_PENDING'/)
  assert.match(subscriptionLib, /status: 'EXPIRED', isActive: false/)
})

test('webhook routes BROKER_REGISTRATION strictly without mutating Broker or Company models', () => {
  assert.match(subscriptionLib, /if \(ownerType === 'BROKER_REGISTRATION'\)/)
  assert.match(subscriptionLib, /updateRegistrationSubscriptionFromStripe/)
  assert.match(subscriptionLib, /if \(ownerType === 'COMPANY'\)/)
})

// ===========================================================================
// 8. BROKER DASHBOARD ACCESS
// ===========================================================================

test('broker dashboard is accessible to both FREE and FEATURED brokers', () => {
  // The dashboard is a professional profile-management home with no
  // paid-gated analytics, so FREE and FEATURED brokers render the same page.
  assert.doesNotMatch(brokerDashboardPage, /hasPaidEntitlement/)
  assert.doesNotMatch(brokerDashboardPage, /contactMessage\.findMany/)
  assert.match(brokerDashboardPage, /BrokerDashboard initialData=\{initialData\}/)
  assert.match(brokerDashboardPage, /toBrokerOwnerDto\(user\.brokerProfile\)/)
})
