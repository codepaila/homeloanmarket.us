import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {
  getCompanyOnboardingStatus,
  isCompanyProfileComplete,
  resolveCompanyOnboardingDestination,
} from '../lib/company-onboarding-state'

const read = (path: string) => fs.readFileSync(path, 'utf8')

const schema = read('prisma/schema.prisma')
const registerRoute = read('app/api/company/register/route.ts')
const intentRoute = read('app/api/auth/company-intent/route.ts')
const intentLib = read('lib/company-intent.ts')
const verifyEmail = read('app/api/auth/verify-email/route.ts')
const onboardingRoute = read('app/api/company/onboarding/route.ts')
const plansApi = read('app/api/company/subscription/plans/route.ts')
const companyPlanLib = read('lib/company-plan.ts')
const companyPlanDefs = read('lib/company-plan-definitions.ts')
const checkout = read('app/api/company/subscription/checkout/route.ts')
const couponRoute = read('app/api/company/subscription/coupon/validate/route.ts')
const couponLib = read('lib/company-coupon.ts')
const selectPageServer = read('app/company/subscription/select/page.tsx')
const requestsRoute = read('app/api/company/requests/route.ts')
const adAccessLib = read('lib/company-ad-access.ts')
const webhook = read('app/api/stripe/webhook/route.ts')
const subscriptionLib = read('lib/subscription.ts')
const dashboardPage = read('app/company/dashboard/page.tsx')

// ===========================================================================
// 1. REGISTRATION — account context only, never billing
// ===========================================================================

test('REGISTRATION: email company registration creates User + PENDING Company + OWNER, never billing', () => {
  assert.match(registerRoute, /role: 'USER'/)
  assert.match(registerRoute, /status: 'PENDING'/)
  assert.match(registerRoute, /role: 'OWNER'/)
  assert.doesNotMatch(registerRoute, /companySubscription\.create|CompanySubscription/)
  assert.doesNotMatch(registerRoute, /stripe\.|checkout\.sessions/)
  assert.doesNotMatch(registerRoute, /brokerSubscription|brokerRegistration/)
})

test('REGISTRATION: Google intent establishes Company + OWNER idempotently without charging', () => {
  assert.match(intentLib, /companyMembership\.findFirst/)
  assert.match(intentLib, /\{ alreadyCompany: true\s*as const/)
  assert.match(intentLib, /company\.create/)
  assert.doesNotMatch(intentLib, /companySubscription\.create|stripe\.|checkout\.sessions/)
})

test('REGISTRATION: duplicate registration is idempotent and bounded by a unique membership', () => {
  assert.match(schema, /@@unique\(\[companyId, userId\]\)/)
  assert.match(registerRoute, /An account with this email already exists/)
  assert.match(intentLib, /existingMembership/)
})

// ===========================================================================
// 2. PROFILE — what "complete" means
// ===========================================================================

test('PROFILE: isCompanyProfileComplete requires status ACTIVE + onboardedAt (never status alone)', () => {
  assert.equal(isCompanyProfileComplete(null), false)
  assert.equal(isCompanyProfileComplete(undefined), false)
  assert.equal(isCompanyProfileComplete({ status: 'PENDING', onboardedAt: null }), false)
  // status can be flipped ACTIVE by the Stripe webhook for a company that
  // activated billing before onboarding — that alone is NOT a completed profile.
  assert.equal(isCompanyProfileComplete({ status: 'ACTIVE', onboardedAt: null }), false)
  assert.equal(isCompanyProfileComplete({ status: 'ACTIVE', onboardedAt: new Date('2026-01-01') }), true)
})

test('PROFILE: onboarding PATCH validates every required field and sets status ACTIVE + onboardedAt', () => {
  assert.match(onboardingRoute, /All company onboarding fields are required/)
  assert.match(onboardingRoute, /status: 'ACTIVE'/)
  assert.match(onboardingRoute, /onboardedAt:/)
  assert.match(onboardingRoute, /getCurrentCompany/)
})

// ===========================================================================
// 3. PLAN — exactly one active customer-facing plan, server-authoritative
// ===========================================================================

test('PLAN: exactly one active customer-facing company advertising plan is defined', () => {
  const defs = companyPlanDefs.match(/name:\s*'([^']+)'[\s\S]*?isActive:\s*(true|false)/g) || []
  const activeDefs = defs.filter((block) => /isActive:\s*true/.test(block))
  assert.equal(activeDefs.length, 1, 'definitions expose exactly one active plan')
  assert.match(companyPlanDefs, /name: 'ADVERTISING'/)
})

test('PLAN: customer plans API exposes only the canonical active plan', () => {
  assert.match(plansApi, /getCanonicalCompanyAdvertisingPlan/)
  assert.doesNotMatch(plansApi, /findMany/)
})

test('PLAN: checkout rejects a missing/inactive/arbitrary plan (server-authoritative)', () => {
  assert.match(checkout, /No active company advertising plan is available/)
  assert.match(companyPlanLib, /where: \{ id: planId, isActive: true \}/)
  assert.match(checkout, /getCanonicalCompanyAdvertisingPlan/)
})

test('PLAN: an arbitrary (non-ObjectId) plan id fails closed instead of throwing a 500', () => {
  assert.match(companyPlanLib, /OBJECT_ID_RE/)
  assert.match(companyPlanLib, /if \(!isValidCompanyPlanId\(planId\)\) return null/)
})

test('PLAN: client can never supply price, Stripe price ID, or plan configuration', () => {
  assert.doesNotMatch(checkout, /body\.price|body\.priceId|body\.stripePriceId|body\.discount|body\.finalPrice/)
  assert.match(checkout, /plan\.stripePriceId/)
})

// ===========================================================================
// 4. COUPON — Stripe promotion codes only, fail-closed, no internal IDs leaked
// ===========================================================================

test('COUPON: server resolves the Stripe promotion code and verifies the backing coupon', () => {
  assert.match(couponLib, /promotionCodes\.list\(\{ code/)
  assert.match(couponLib, /promotionCode\.active/)
  assert.match(couponLib, /coupon\.valid !== true/)
  assert.match(couponLib, /This promotion code is not valid/)
})

test('COUPON: internal promotion_code ID is never exposed to the client', () => {
  assert.doesNotMatch(couponRoute, /promotionCodeId/)
  assert.match(couponRoute, /percentOff/)
  assert.match(couponRoute, /amountOff/)
})

test('COUPON: checkout passes the resolved promotion_code via discounts and omits allow_promotion_codes', () => {
  assert.match(checkout, /discounts: \[\{ promotion_code: coupon\.promotionCodeId \}\]/)
  assert.match(checkout, /\? \{ discounts: \[\{ promotion_code: coupon\.promotionCodeId \}\] \}\s*:\s*\{ allow_promotion_codes: false \}/)
  assert.doesNotMatch(checkout, /allow_promotion_codes:\s*[^,\n]+\s*,\s*discounts/)
  assert.doesNotMatch(checkout, /discounts:\s*\[[^\]]*\]\s*,\s*allow_promotion_codes/)
})

// ===========================================================================
// 5. CHECKOUT — profile gate, canonical plan, subscription mode, COMPANY owner
// ===========================================================================

test('CHECKOUT: incomplete profile cannot checkout (server-enforced)', () => {
  assert.match(checkout, /isCompanyProfileComplete\(current\.company\)/)
  assert.match(checkout, /PROFILE_REQUIRED/)
  assert.match(checkout, /Complete your company profile before selecting an advertising plan/)
})

test('CHECKOUT: subscription mode + COMPANY owner metadata + DB Stripe price', () => {
  assert.match(checkout, /mode: 'subscription'/)
  assert.match(checkout, /ownerType: 'COMPANY'/)
  assert.match(checkout, /line_items: \[\{ price: priceId!, quantity: 1 \}\]/)
  assert.match(checkout, /metadata: \{ userId: current\.user\.id, companyId: current\.company\.id/)
})

test('CHECKOUT: idempotency — open session reuse and content-fingerprinted key', () => {
  assert.match(checkout, /buildCompanyCheckoutIdempotencyKey/)
  assert.match(checkout, /priorCheckout\?\.status === 'open'/)
  assert.match(checkout, /session\.metadata\?\.companyId === current\.company\.id/)
  assert.match(checkout, /withBillingLock/)
})

// ===========================================================================
// 6. WEBHOOK — COMPANY ownerType only, never broker rows
// ===========================================================================

test('WEBHOOK: company events route via ownerType COMPANY and update CompanySubscription only', () => {
  assert.match(webhook, /ownerType === 'COMPANY'/)
  assert.match(webhook, /ownerType === 'BROKER_REGISTRATION'/)
  assert.match(subscriptionLib, /if \(ownerType === 'COMPANY'\)/)
  assert.match(subscriptionLib, /this\.updateCompanySubscriptionFromStripe\(/)
  assert.match(subscriptionLib, /if \(ownerType === 'BROKER_REGISTRATION'\)/)
  assert.match(subscriptionLib, /this\.updateRegistrationSubscriptionFromStripe\(/)
  // The company method never touches broker-registration rows.
  const companyMethod = subscriptionLib.slice(
    subscriptionLib.indexOf('static async updateCompanySubscriptionFromStripe'),
    subscriptionLib.indexOf('static async cancelSubscription'),
  )
  assert.doesNotMatch(companyMethod, /brokerRegistration|brokerSubscription/)
})

test('WEBHOOK: only active/trialing maps to ACTIVE/isActive; every other state is non-active', () => {
  assert.match(subscriptionLib, /case 'active':/)
  assert.match(subscriptionLib, /case 'trialing':/)
  assert.match(subscriptionLib, /mapCompanySubscriptionStatus/)
})

// ===========================================================================
// 7. ACCESS — advertising request requires ACTIVE subscription server-side
// ===========================================================================

test('ACCESS: advertisement request is gated by ACTIVE CompanySubscription server-side', () => {
  assert.match(requestsRoute, /hasActiveCompanyAdvertisingSubscription/)
  assert.match(requestsRoute, /SUBSCRIPTION_REQUIRED_ERROR_CODE/)
  assert.match(adAccessLib, /status === 'ACTIVE' && subscription\?\.isActive === true/)
})

test('ACCESS: dashboard keeps account access separate from advertising capability', () => {
  assert.match(dashboardPage, /reconcileStaleCompanyCheckout/)
  assert.match(dashboardPage, /onboarded/)
})

// ===========================================================================
// 8. RESUME — canonical state machine destinations
// ===========================================================================

const pending = { status: 'ACTIVE', onboardedAt: new Date(), subscription: { status: 'CHECKOUT_PENDING', isActive: false } }
const complete = { status: 'ACTIVE', onboardedAt: new Date(), subscription: null }
const active = { status: 'ACTIVE', onboardedAt: new Date(), subscription: { status: 'ACTIVE', isActive: true } }
const incomplete = { status: 'PENDING', onboardedAt: null, subscription: null }

test('RESUME: incomplete profile redirects to onboarding (every entry point)', () => {
  assert.equal(getCompanyOnboardingStatus(incomplete), 'PROFILE_INCOMPLETE')
  assert.equal(resolveCompanyOnboardingDestination(incomplete, '/company/dashboard'), '/company/onboarding')
  assert.equal(resolveCompanyOnboardingDestination(incomplete, '/company/subscription/select'), '/company/onboarding')
  assert.equal(resolveCompanyOnboardingDestination(incomplete, '/company/onboarding'), null)
})

test('RESUME: completed profile with no active subscription redirects to plan selection', () => {
  assert.equal(getCompanyOnboardingStatus(complete), 'PROFILE_COMPLETE')
  assert.equal(resolveCompanyOnboardingDestination(complete, '/company/dashboard'), '/company/subscription/select')
  assert.equal(resolveCompanyOnboardingDestination(complete, '/company/subscription/select'), null)
})

test('RESUME: pending checkout resumes safely at plan selection', () => {
  assert.equal(getCompanyOnboardingStatus(pending), 'CHECKOUT_PENDING')
  assert.equal(resolveCompanyOnboardingDestination(pending, '/company/dashboard'), '/company/subscription/select')
  assert.equal(resolveCompanyOnboardingDestination(pending, '/company/subscription/select'), null)
})

test('RESUME: active subscription reaches the company dashboard', () => {
  assert.equal(getCompanyOnboardingStatus(active), 'COMPLETED')
  assert.equal(resolveCompanyOnboardingDestination(active, '/company/subscription/select'), '/company/dashboard')
  assert.equal(resolveCompanyOnboardingDestination(active, '/company/dashboard'), null)
})

test('RESUME: plan-select page applies the same gate server-side', () => {
  assert.match(selectPageServer, /getCompanyOnboardingStatus/)
  assert.match(selectPageServer, /PROFILE_INCOMPLETE/)
  assert.match(selectPageServer, /COMPLETED/)
})

// ===========================================================================
// 9. EMAIL + GOOGLE parity on the same lifecycle
// ===========================================================================

test('EMAIL + GOOGLE converge: both post-auth entry points route to the same canonical lifecycle', () => {
  assert.match(verifyEmail, /companyMemberships\?\.length \? '\/company\/onboarding'/)
  assert.match(intentRoute, /resolveCompanyOnboardingDestination/)
  assert.match(intentRoute, /redirectTo/)
  assert.doesNotMatch(intentRoute, /stripe\.|checkout\.sessions/)
})

// ===========================================================================
// 10. BROKER ISOLATION
// ===========================================================================

test('ISOLATION: company flow never touches broker billing models', () => {
  assert.doesNotMatch(checkout, /brokerSubscription|BrokerSubscriptionPlan/)
  assert.doesNotMatch(registerRoute, /brokerRegistration|brokerSubscription/)
  assert.doesNotMatch(companyPlanLib, /BrokerSubscriptionPlan/)
  assert.doesNotMatch(couponLib, /BrokerSubscriptionPlan/)
})