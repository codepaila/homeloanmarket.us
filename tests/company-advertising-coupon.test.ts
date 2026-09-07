import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')

const checkout = read('app/api/company/subscription/checkout/route.ts')
const couponRoute = read('app/api/company/subscription/coupon/validate/route.ts')
const couponLib = read('lib/company-coupon.ts')
const selectPage = read('app/company/subscription/select/CompanySubscriptionSelect.tsx')
const plansApi = read('app/api/company/subscription/plans/route.ts')
const companyPlanLib = read('lib/company-plan.ts')
const subscriptionLib = read('lib/subscription.ts')
const companyPolicy = read('lib/company-policy.ts')
const dashboardPage = read('app/company/dashboard/page.tsx')
const dashboardClient = read('app/company/dashboard/CompanyDashboardClient.tsx')

// ---------------------------------------------------------------------------
// Server-authoritative: never trust client financial values
// ---------------------------------------------------------------------------

test('checkout derives plan/price/coupon entirely server-side', () => {
  // Company identity comes from the authenticated membership, not the body.
  assert.match(checkout, /getCurrentCompany\(\)/)
  assert.doesNotMatch(checkout, /body\.companyId|body\.price|body\.stripePriceId|body\.discount|body\.finalPrice/)
})

test('client cannot provide an arbitrary Stripe price ID', () => {
  assert.doesNotMatch(checkout, /body\.priceId|body\.stripePriceId/)
  assert.match(checkout, /plan\.stripePriceId/)
})

test('client cannot control the discount amount or final price', () => {
  assert.doesNotMatch(checkout, /body\.discount|body\.finalPrice|body\.amount/)
  assert.match(checkout, /validateCompanyCoupon/)
})

test('promotion codes at Stripe checkout are disabled so the server controls the discount', () => {
  assert.match(checkout, /allow_promotion_codes: false/)
  assert.doesNotMatch(checkout, /allow_promotion_codes: true/)
})

// ---------------------------------------------------------------------------
// Coupon validation
// ---------------------------------------------------------------------------

test('coupon validation is server-side via Stripe promotion codes and fails closed', () => {
  assert.match(couponLib, /promotionCodes\.list\(\{ code/)
  assert.match(couponLib, /Coupon validation is unavailable|This promotion code is not valid/)
  assert.doesNotMatch(couponLib, /process\.env\.STRIPE_SECRET_KEY\s*=\s*/)
  assert.doesNotMatch(couponLib, /stripe\.coupons\.retrieve\(normalized\)/)
})

test('coupon validate route is same-origin only', () => {
  assert.match(couponRoute, /isSameOriginRequest/)
})

// ---------------------------------------------------------------------------
// Free plan + coupon edge cases
// ---------------------------------------------------------------------------

test('coupons apply only to paid plans; a coupon is never required for FREE', () => {
  // Coupon validation is guarded by the paid-plan branch.
  assert.match(checkout, /if \(plan\.price > 0 && couponCode\)/)
})

test('free plans activate without Stripe and without coupon', () => {
  assert.match(checkout, /if \(plan\.price <= 0\)/)
  assert.doesNotMatch(checkout, /plan\.price <= 0[\s\S]{0,120}stripe\.checkout\.sessions\.create/)
})

// ---------------------------------------------------------------------------
// Paid plan checkout
// ---------------------------------------------------------------------------

test('paid plans use the DB plan Stripe price ID and a server-validated promotion code', () => {
  assert.match(checkout, /line_items: \[\{ price: priceId!, quantity: 1 \}\]/)
  assert.match(checkout, /discounts: \[\{ promotion_code: coupon\.promotionCodeId \}\]/)
})

test('inactive plans are not offered for purchase', () => {
  assert.match(plansApi, /getCanonicalCompanyAdvertisingPlan/)
  assert.match(companyPlanLib, /where: \{ id: planId, isActive: true \}/)
})

// ---------------------------------------------------------------------------
// Ownership / isolation
// ---------------------------------------------------------------------------

test('company subscription operations require an authenticated company membership', () => {
  assert.match(checkout, /getCurrentCompany/)
  assert.match(checkout, /Company access required/)
  assert.match(companyPolicy, /companyMembership\.findFirst/)
})

test('checkout uses a billing lock to prevent duplicate concurrent checkouts', () => {
  assert.match(checkout, /withBillingLock/)
  assert.match(checkout, /An existing company subscription is already active/)
})

test('coupon never causes broker subscription changes', () => {
  assert.doesNotMatch(couponLib, /brokerSubscription|BrokerSubscriptionPlan/)
  assert.doesNotMatch(checkout, /brokerSubscription|BrokerSubscriptionPlan/)
})

test('no broker-plan dependency in company billing', () => {
  assert.doesNotMatch(companyPlanLib, /BrokerSubscriptionPlan/)
  assert.doesNotMatch(couponLib, /BrokerSubscriptionPlan/)
})

// ---------------------------------------------------------------------------
// Webhook / synchronization
// ---------------------------------------------------------------------------

test('company webhook sync updates the company subscription without coupon causing plan drift', () => {
  // The webhook resolves the plan by Stripe price; it does not recompute price
  // from any coupon value.
  assert.match(subscriptionLib, /resolveCompanyPlanByStripePrice\(priceId\)/)
  assert.doesNotMatch(subscriptionLib, /updateCompanySubscriptionFromStripe[\s\S]{0,200}coupon/)
})

test('coupon discount is not trusted as a plan price override', () => {
  assert.doesNotMatch(checkout, /coupon.*plan\.price\s*=/)
  assert.doesNotMatch(checkout, /coupon.*price\s*:/)
})

// ---------------------------------------------------------------------------
// Dashboard separation + UX
// ---------------------------------------------------------------------------

test('dashboard keeps the advertising plan separate from the advertisement request', () => {
  assert.match(dashboardClient, /Company Advertising Plan/)
  assert.match(dashboardClient, /Request Advertisement/)
  assert.match(dashboardClient, /grants access to the advertisement-request functionality/)
})

test('dashboard shows current plan, price, status, and billing period', () => {
  assert.match(dashboardClient, /Current plan/)
  assert.match(dashboardClient, /Status/)
  assert.match(dashboardClient, /Renews \/ ends|Active since/)
  assert.match(dashboardPage, /advertisingPlan/)
})

test('coupon select UI has loading, error, success, and remove states', () => {
  assert.match(selectPage, /Checking…/)
  assert.match(selectPage, /Coupon applied:/)
  assert.match(selectPage, /Remove/)
  assert.match(selectPage, /applying/)
  assert.match(selectPage, /final amount is set by the server, not the browser/)
})

test('coupon is only sent to checkout after server validation succeeds', () => {
  assert.match(selectPage, /couponState === 'applied' \? couponAppliedCode : ''/)
})

// ---------------------------------------------------------------------------
// No static company plan catalog
// ---------------------------------------------------------------------------

test('company plans are DB-backed, not a static catalog', () => {
  assert.match(plansApi, /getCanonicalCompanyAdvertisingPlan/)
  assert.doesNotMatch(plansApi, /subscriptionPlans from/)
  assert.match(companyPlanLib, /companyAdvertisingPlan\.findMany/)
})

test('no hard-coded company plan prices in the checkout or coupon path', () => {
  assert.doesNotMatch(checkout, /price: (15|30|1999|4999)\b/)
  assert.doesNotMatch(couponLib, /\$\{?\s*\d{2,}\s*\}?\s*\/\s*month/)
})

// ---------------------------------------------------------------------------
// Phase 8.14: Stripe parameter safety regression (allow_promotion_codes vs
// discounts are MUTUALLY EXCLUSIVE). Stripe rejects a Session that carries
// both simultaneously. This test fails if the two ever appear together.
// ---------------------------------------------------------------------------

test('checkout never sends allow_promotion_codes and discounts together (8.14)', () => {
  // The two params must be produced by a single mutually-exclusive ternary so
  // both can never appear in the outgoing sessionParams object.
  assert.match(
    checkout,
    /\.\.\.\((coupon && coupon\.valid)\s*\n\s*\? \{\s*discounts: \[\{ promotion_code: coupon\.promotionCodeId \}\] \}\s*\n\s*: \{ allow_promotion_codes: false \}\)/,
  )
  // A literal object that would carry both keys at once must not exist.
  assert.doesNotMatch(checkout, /allow_promotion_codes:\s*[^,\n]+\s*,\s*discounts/)
  assert.doesNotMatch(checkout, /discounts:\s*\[[^\]]*\]\s*,\s*allow_promotion_codes/)
})

test('discounts branch carries only discounts; valid-coupon path omits allow_promotion_codes', () => {
  assert.match(checkout, /discounts: \[\{ promotion_code: coupon\.promotionCodeId \}\]/)
  // The session params spread is guarded by a single ternary: when a valid
  // coupon exists it spreads ONLY the discounts object; the
  // allow_promotion_codes:false branch is the mutually-exclusive else.
  assert.match(checkout, /\? \{ discounts: \[\{ promotion_code: coupon\.promotionCodeId \}\] \}\s*:\s*\{ allow_promotion_codes: false \}/)
})

// ---------------------------------------------------------------------------
// Phase 8.14: discount preview (display-only, never used for pricing)
// ---------------------------------------------------------------------------

test('coupon UI renders a display-only discount preview without computing a total (8.14)', () => {
  // Server returns only display-safe fields for optional client rendering.
  assert.match(couponRoute, /percentOff/)
  assert.match(couponRoute, /amountOff/)
  assert.doesNotMatch(couponRoute, /finalPrice|total|discountedPrice|priceAfterCoupon/)
  // Client shows Save {percent}% / Save ${amount} from server fields.
  assert.match(selectPage, /setCouponDiscount\(`Save \$\{data\.percentOff\}%`\)/)
  assert.match(selectPage, /data\.amountOff/)
  assert.match(selectPage, /\{couponDiscount && \(/)
})