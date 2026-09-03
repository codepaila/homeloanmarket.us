import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {
  BROKER_PLAN_DISPLAY_NAME,
  DEFAULT_BROKER_PLANS,
  SUPPORTED_BROKER_PLAN_CODES,
  isSupportedBrokerPlanCode,
  getBrokerPlanDisplayName,
} from '../lib/broker-plans'

const read = (path: string) => fs.readFileSync(path, 'utf8')
const createApi = read('app/api/admin/broker-plans/route.ts')
const detailApi = read('app/api/admin/broker-plans/[id]/route.ts')
const newPage = read('app/admin/billing/broker-plans/new/page.tsx')
const detailPage = read('app/admin/billing/broker-plans/[id]/page.tsx')
const listPage = read('app/admin/billing/broker-plans/page.tsx')
const plansApi = read('app/api/subscription/plans/route.ts')
const checkoutApi = read('app/api/broker-registration/subscription/checkout/route.ts')
const schema = read('prisma/schema.prisma')

// ---------------------------------------------------------------------------
// Fixed plan model
// ---------------------------------------------------------------------------

test('1. FREE is a supported fixed plan', () => {
  assert.equal(isSupportedBrokerPlanCode('FREE'), true)
  assert.ok(SUPPORTED_BROKER_PLAN_CODES.includes('FREE'))
})

test('2. FEATURED is a supported fixed plan', () => {
  assert.equal(isSupportedBrokerPlanCode('FEATURED'), true)
  assert.ok(SUPPORTED_BROKER_PLAN_CODES.includes('FEATURED'))
})

test('3. PREMIUM is NOT an admin-supported fixed plan', () => {
  assert.equal(isSupportedBrokerPlanCode('PREMIUM'), false)
})

test('supported codes match the fixed plan list exactly', () => {
  assert.deepEqual([...SUPPORTED_BROKER_PLAN_CODES], ['FREE', 'FEATURED'])
})

// ---------------------------------------------------------------------------
// Display names (single canonical mapping)
// ---------------------------------------------------------------------------

test('12. FREE customer-facing name resolves to Free', () => {
  assert.equal(getBrokerPlanDisplayName('FREE'), 'Free')
})

test('13. FEATURED customer-facing name resolves to Mortgage Expert', () => {
  assert.equal(getBrokerPlanDisplayName('FEATURED'), 'Mortgage Expert')
  assert.equal(BROKER_PLAN_DISPLAY_NAME.FEATURED, 'Mortgage Expert')
})

test('14. internal FEATURED code is preserved (not renamed to MORTGAGE_EXPERT)', () => {
  assert.ok(SUPPORTED_BROKER_PLAN_CODES.includes('FEATURED'))
  assert.equal(isSupportedBrokerPlanCode('MORTGAGE_EXPERT'), false)
  assert.equal(BROKER_PLAN_DISPLAY_NAME.FEATURED, 'Mortgage Expert')
})

test('unknown codes resolve to no display name (rejected server-side)', () => {
  assert.equal(getBrokerPlanDisplayName('PREMIUM'), null)
})

// ---------------------------------------------------------------------------
// Admin CREATE
// ---------------------------------------------------------------------------

test('4. create derives the canonical name from the fixed plan identity', () => {
  assert.match(createApi, /getBrokerPlanDisplayName/)
  assert.match(createApi, /const name = getBrokerPlanDisplayName\(code\)/)
})

test('5. create rejects an unknown/arbitrary plan code', () => {
  assert.match(createApi, /isSupportedBrokerPlanCode/)
  assert.match(createApi, /Only FREE and FEATURED plans are supported/)
  assert.match(createApi, /status: 400/)
})

test('6. create rejects an arbitrary client-provided display name', () => {
  assert.match(createApi, /Plan name is derived from the fixed plan identity and cannot be changed/)
  assert.match(createApi, /status: 400/)
})

test('7. create rejects a duplicate fixed plan with 409', () => {
  assert.match(createApi, /A plan with this code already exists/)
  assert.match(createApi, /status: 409/)
})

test('8. concurrent duplicate create maps the unique violation to 409', () => {
  assert.match(createApi, /P2002/)
  assert.match(createApi, /status: 409/)
  // The DB unique constraint on `code` is the authoritative guarantee.
  assert.match(schema, /code\s+String\s+@unique/)
})

test('9. non-admin create is rejected with 403', () => {
  assert.match(createApi, /Forbidden/)
  assert.match(createApi, /status: 403/)
})

// ---------------------------------------------------------------------------
// Admin UPDATE
// ---------------------------------------------------------------------------

test('10. update rejects changing plan identity (FREE->FEATURED / FEATURED->FREE)', () => {
  assert.match(detailApi, /Plan identity cannot be changed/)
  assert.match(detailApi, /code !== plan\.code/)
  // No editable code assignment remains.
  assert.doesNotMatch(detailApi, /data\.code = code/)
})

test('11. update derives the canonical name and rejects overrides', () => {
  assert.match(detailApi, /Plan name is derived from the fixed plan identity and cannot be changed/)
  assert.match(detailApi, /getBrokerPlanDisplayName\(plan\.code\)/)
})

test('12. update support for a fixed plan is retained (configurable fields)', () => {
  assert.match(detailApi, /data\.price =/)
  assert.match(detailApi, /data\.isActive =/)
  assert.match(detailApi, /data\.billingInterval =/)
})

test('13. non-admin update is rejected with 403', () => {
  assert.match(detailApi, /Forbidden/)
  assert.match(detailApi, /status: 403/)
})

// ---------------------------------------------------------------------------
// Admin form UX (fixed selector, read-only identity)
// ---------------------------------------------------------------------------

test('create form has no free-text plan name/code inputs', () => {
  assert.doesNotMatch(newPage, /label="Name"/)
  assert.doesNotMatch(newPage, /label="Code"/)
  assert.doesNotMatch(newPage, /set\('name'/)
  assert.doesNotMatch(newPage, /set\('code'/)
})

test('create form uses a fixed plan selector with availability state', () => {
  assert.match(newPage, /Select a fixed plan to create/)
  assert.match(newPage, /supportedPlans/)
  assert.match(newPage, /Already configured/)
})

test('edit form shows fixed plan identity as read-only', () => {
  assert.match(detailPage, /Plan identity and customer-facing name are fixed and cannot be changed/)
  assert.doesNotMatch(detailPage, /onChange=\{\(e\) => setField\('name'/)
  assert.doesNotMatch(detailPage, /onChange=\{\(e\) => setField\('code'/)
})

test('admin list page derives the display name from the canonical mapping', () => {
  assert.match(listPage, /getBrokerPlanDisplayName/)
  assert.match(listPage, /getBrokerPlanDisplayName\(plan\.code\)/)
})

// ---------------------------------------------------------------------------
// Features are display-only content (label/enabled/sortOrder), not entitlements
// ---------------------------------------------------------------------------

test('feature model has only display fields (id/planId/label/enabled/sortOrder)', () => {
  const feature = schema.slice(schema.indexOf('model BrokerSubscriptionPlanFeature'), schema.indexOf('model BrokerRegistration'))
  assert.match(feature, /id\s+String/)
  assert.match(feature, /planId\s+String\s+@db\.ObjectId/)
  assert.match(feature, /label\s+String/)
  assert.match(feature, /enabled\s+Boolean/)
  assert.match(feature, /sortOrder\s+Int/)
  assert.doesNotMatch(feature, /code\s+String/)
  assert.doesNotMatch(feature, /featureCode|entitlement|permission/)
})

test('feature sync supports add/edit/enable/disable/reorder (no entitlement codes)', () => {
  assert.match(detailApi, /syncPlanFeatures/)
  assert.match(detailApi, /sanitizeFeatureDrafts/)
  // Updates happen in place by id; new rows are created; missing rows deleted.
  assert.match(detailApi, /One or more features do not belong to this plan/)
})

test('public plan API excludes disabled features', () => {
  assert.match(read('lib/broker-plans.ts'), /\.filter\(\(feature\) => feature\.enabled\)/)
})

test('public plan API sorts enabled features by sortOrder', () => {
  assert.match(read('lib/broker-plans.ts'), /\.sort\(\(a, b\) => a\.sortOrder - b\.sortOrder\)/)
})

// ---------------------------------------------------------------------------
// Public plan API
// ---------------------------------------------------------------------------

test('public plans API returns broker plans only via the DB-backed public shape', () => {
  assert.match(plansApi, /listBrokerPlansPublic/)
  assert.doesNotMatch(plansApi, /CompanyAdvertisingPlan/)
})

test('public plan shape derives name from the canonical display mapping', () => {
  assert.match(read('lib/broker-plans.ts'), /BROKER_PLAN_DISPLAY_NAME\[plan\.code\]/)
})

test('FREE public plan exposes a zero monthly price', () => {
  const free = DEFAULT_BROKER_PLANS.find((p) => p.code === 'FREE')!
  assert.equal(free.price, 0)
  assert.equal(free.billingInterval, 'month')
})

test('FEATURED public plan carries its configured price and Mortgage Expert name', () => {
  const featured = DEFAULT_BROKER_PLANS.find((p) => p.code === 'FEATURED')!
  assert.ok(featured.price > 0)
  assert.equal(BROKER_PLAN_DISPLAY_NAME.FEATURED, 'Mortgage Expert')
})

// ---------------------------------------------------------------------------
// Registration / checkout / FREE flow
// ---------------------------------------------------------------------------

test('broker registration checkout resolves the plan from the database by code + price', () => {
  assert.match(checkoutApi, /validateBrokerPlanForCheckout/)
  assert.match(checkoutApi, /metadata: \{ userId: user\.id, brokerRegistrationId: registrationId, plan: 'FEATURED' \}/)
})

test('FREE activation remains server-driven via the dynamic FREE plan', () => {
  assert.match(read('lib/broker-plans.ts'), /BROKER_FREE_PLAN_CODE = 'FREE'/)
  assert.match(read('lib/broker-plans.ts'), /create: \{ brokerId, plan: BROKER_FREE_PLAN_CODE/)
})

test('existing subscription behavior and plan lookup helpers are intact', () => {
  assert.match(read('lib/broker-plans.ts'), /getBrokerPlanByCode/)
  assert.match(read('lib/broker-plans.ts'), /resolveBrokerPlanByCode/)
  assert.match(read('lib/broker-plans.ts'), /validateBrokerPlanForCheckout/)
})

// ---------------------------------------------------------------------------
// Stripe safety
// ---------------------------------------------------------------------------

test('price update follows the safe active-subscription Stripe guard', () => {
  assert.match(detailApi, /hasActiveSubscriptions > 0 && stripeMappingChanged/)
  assert.match(detailApi, /Changing its Stripe price\/product would break active billing/)
  assert.match(detailApi, /status: 409/)
})

test('deactivation is blocked while active subscriptions exist; never cancels them', () => {
  assert.match(detailApi, /hasActiveSubscriptions > 0/)
  assert.match(detailApi, /Deactivate those subscriptions before deactivating the plan/)
  assert.doesNotMatch(detailApi, /subscription\.updateMany/)
})

test('broker and company Stripe plans are isolated (cross-product price guard)', () => {
  assert.match(createApi, /assertStripePriceIsolation/)
  assert.match(detailApi, /assertStripePriceIsolation/)
  assert.match(read('lib/plan-price-isolation.ts'), /brokerSubscriptionPlan\.findFirst/)
})

test('CompanyAdvertisingPlan is completely untouched by broker plan routes', () => {
  // Broker plan routes never import, query, or write to the company model.
  // (Explanatory comments referencing the company guard are allowed.)
  assert.doesNotMatch(createApi + detailApi, /prisma\.companyAdvertisingPlan/)
  assert.doesNotMatch(createApi + detailApi, /from '@\/lib\/company/)
  assert.doesNotMatch(createApi + detailApi, /companyAdvertisingPlan\.\w+\(/)
})

test('legacy PREMIUM remains in the schema enum for compatibility only', () => {
  assert.match(schema, /enum SubscriptionPlan \{[\s\S]*FREE[\s\S]*FEATURED[\s\S]*PREMIUM/)
})

test('reconciliation never overwrites admin feature customization', () => {
  assert.match(read('scripts/reconcile-broker-plans.ts'), /Do NOT sync features here/)
  assert.match(read('scripts/reconcile-broker-plans.ts'), /existingLabels/)
})
