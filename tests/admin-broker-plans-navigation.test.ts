import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')
const exists = (path: string) => fs.existsSync(path)

const nav = read('components/layout/admin/sideBarData.ts')
const listPage = exists('app/admin/billing/broker-plans/page.tsx') ? read('app/admin/billing/broker-plans/page.tsx') : ''
const newPage = exists('app/admin/billing/broker-plans/new/page.tsx') ? read('app/admin/billing/broker-plans/new/page.tsx') : ''
const detailPage = exists('app/admin/billing/broker-plans/[id]/page.tsx') ? read('app/admin/billing/broker-plans/[id]/page.tsx') : ''
const listApi = read('app/api/admin/broker-plans/route.ts')
const detailApi = read('app/api/admin/broker-plans/[id]/route.ts')
const checkoutApi = read('app/api/subscription/checkout/route.ts')
const upgradeApi = read('app/api/subscription/upgrade/route.ts')
const plansApi = read('app/api/subscription/plans/route.ts')
const reconcile = read('scripts/reconcile-broker-plans.ts')
const brokerPlansLib = read('lib/broker-plans.ts')

// ---------------------------------------------------------------------------
// 1. Admin navigation contains Broker Plans
// ---------------------------------------------------------------------------

test('admin navigation exposes Broker Plans under Billing', () => {
  assert.match(nav, /title: "Billing"/)
  assert.match(nav, /title: "Broker Plans", url: "\/admin\/billing\/broker-plans"/)
  assert.match(nav, /title: "Broker Subscriptions", url: "\/admin\/billing\/broker-subscriptions"/)
})

test('Broker Plans nav item is admin-only', () => {
  // The Billing section is declared inside the isAdmin-guarded adminNavItems array.
  const adminBlock = nav.slice(nav.indexOf('const adminNavItems: SidebarItem[] = isAdmin'), nav.indexOf('const brokerNavItems'))
  assert.match(adminBlock, /title: "Broker Plans", url: "\/admin\/billing\/broker-plans"/)
  assert.match(adminBlock, /title: "Billing"/)
})

// ---------------------------------------------------------------------------
// 2. Existing Broker Plan routes resolve
// ---------------------------------------------------------------------------

test('Broker Plans admin pages exist (list, new, detail)', () => {
  assert.ok(exists('app/admin/billing/broker-plans/page.tsx'), 'list page missing')
  assert.ok(exists('app/admin/billing/broker-plans/new/page.tsx'), 'new page missing')
  assert.ok(exists('app/admin/billing/broker-plans/[id]/page.tsx'), 'detail page missing')
})

test('Broker Plans API routes exist', () => {
  assert.ok(exists('app/api/admin/broker-plans/route.ts'), 'list/create API missing')
  assert.ok(exists('app/api/admin/broker-plans/[id]/route.ts'), 'detail/update/delete API missing')
})

// ---------------------------------------------------------------------------
// 3. Admin authorization
// ---------------------------------------------------------------------------

test('Broker Plans admin API requires ADMIN (non-admin blocked)', () => {
  assert.match(listApi, /isAdmin\(\)|role !== 'ADMIN'|status: 403/)
  assert.match(detailApi, /isAdmin\(\)|role !== 'ADMIN'|status: 403/)
})

// ---------------------------------------------------------------------------
// 4. Plans come from the DB (BrokerSubscriptionPlan)
// ---------------------------------------------------------------------------

test('Broker Plans list page reads from the DB plan model', () => {
  assert.match(listPage, /brokerSubscriptionPlan\.findMany/)
  assert.match(listPage, /features: true/)
  assert.match(listPage, /displayOrder/)
  assert.match(listPage, /isActive/)
})

test('public subscription plans API is DB-backed', () => {
  assert.match(plansApi, /listBrokerPlansPublic|listBrokerPlans/)
})

// ---------------------------------------------------------------------------
// 5. No static subscriptionPlans catalog in runtime
// ---------------------------------------------------------------------------

test('no static subscriptionPlans catalog remains in runtime plan/pricing paths', () => {
  assert.doesNotMatch(listPage, /from '@\/lib\/stripe'|subscriptionPlans/)
  assert.doesNotMatch(newPage, /from '@\/lib\/stripe'|subscriptionPlans/)
  assert.doesNotMatch(detailPage, /from '@\/lib\/stripe'|subscriptionPlans/)
  assert.doesNotMatch(checkoutApi, /subscriptionPlans/)
  assert.doesNotMatch(upgradeApi, /subscriptionPlans/)
  assert.doesNotMatch(plansApi, /subscriptionPlans/)
})

test('lib/stripe.ts no longer defines a subscriptionPlans catalog', () => {
  const stripe = read('lib/stripe.ts')
  assert.doesNotMatch(stripe, /export const subscriptionPlans = \[/)
})

// ---------------------------------------------------------------------------
// 6. Features come from BrokerSubscriptionPlanFeature
// ---------------------------------------------------------------------------

test('Broker Plans pages use dynamic PROFILE_BADGE / SUPPORT_TICKETS feature rows', () => {
  assert.match(detailPage, /PROFILE_BADGE/)
  assert.match(detailPage, /SUPPORT_TICKETS/)
  assert.match(newPage, /PROFILE_BADGE/)
  assert.match(newPage, /SUPPORT_TICKETS/)
})

test('no stale legacy limits exist in Broker Plans admin pages', () => {
  const stale = ['maxTeamMembers', 'maxBranches', 'maxActiveListings', 'maxLoanProducts', 'maxSavedBrokers', 'maxBankPartners', 'prioritySupport', 'advancedAnalytics', 'customProfile', 'phoneSupport', 'featuredListing', 'analyticsDashboard', 'customReports', 'apiAccess']
  for (const limit of stale) {
    assert.doesNotMatch(listPage + newPage + detailPage, new RegExp(limit), `${limit} must not return`)
  }
})

// ---------------------------------------------------------------------------
// 7. No hard-coded FREE/FEATURED/PREMIUM as entitlement logic
// ---------------------------------------------------------------------------

test('FREE/FEATURED/PREMIUM appear only as seed/codes, not as entitlement branching', () => {
  // The admin pages do not branch on plan codes for entitlement.
  assert.doesNotMatch(listPage + newPage + detailPage, /plan === 'FREE'|plan === 'FEATURED'|plan === 'PREMIUM'/)
  // Entitlement flows through plan features, not plan-code checks.
  assert.match(brokerPlansLib, /planHasFeature/)
  assert.match(brokerPlansLib, /features\?\.some\(\(feature\) => feature\?\.code === featureCode/)
})

// ---------------------------------------------------------------------------
// 8. Existing broker subscriptions remain linked to the same plan IDs (reconcile)
// ---------------------------------------------------------------------------

test('reconcile script links by plan code and preserves plan IDs', () => {
  assert.match(reconcile, /reconcileBrokerSubscriptions\(\)|brokerSubscriptionPlan\.findMany/)
  assert.doesNotMatch(reconcile, /\.delete\(|deleteMany/)
})

// ---------------------------------------------------------------------------
// 9. Customer checkout still uses DB plan Stripe price
// ---------------------------------------------------------------------------

test('customer checkout resolves the Stripe price from the DB plan', () => {
  assert.match(checkoutApi, /validateBrokerPlanForCheckout/)
  assert.doesNotMatch(checkoutApi, /validatePlanPrice|subscriptionPlans/)
})

test('customer upgrade resolves the Stripe price from the DB plan', () => {
  assert.match(upgradeApi, /validateBrokerPlanForCheckout/)
})

// ---------------------------------------------------------------------------
// 10. Stripe safety
// ---------------------------------------------------------------------------

test('Broker Plans admin API validates Stripe IDs and never exposes secrets', () => {
  assert.match(listApi, /validateStripeProductId|validateStripePriceId/)
  assert.doesNotMatch(listApi, /STRIPE_SECRET_KEY/)
  assert.doesNotMatch(detailApi, /STRIPE_SECRET_KEY/)
})