import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { DEFAULT_BROKER_PLAN_FEATURES } from '../lib/broker-plans'

const read = (path: string) => fs.readFileSync(path, 'utf8')
const exists = (path: string) => fs.existsSync(path)

const brokerCreateApi = read('app/api/admin/broker-plans/route.ts')
const brokerDetailApi = read('app/api/admin/broker-plans/[id]/route.ts')
const brokerNewPage = read('app/admin/billing/broker-plans/new/page.tsx')
const brokerDetailPage = read('app/admin/billing/broker-plans/[id]/page.tsx')
const brokerListPage = read('app/admin/billing/broker-plans/page.tsx')
const companyCreateApi = read('app/api/admin/company-advertising-plans/route.ts')
const companyDetailApi = read('app/api/admin/company-advertising-plans/[id]/route.ts')
const companyNewPage = read('app/admin/billing/company-advertising-plans/new/page.tsx')
const companyDetailPage = read('app/admin/billing/company-advertising-plans/[id]/page.tsx')
const featureDefs = DEFAULT_BROKER_PLAN_FEATURES
const navigation = read('lib/admin/navigation.ts')
const schema = read('prisma/schema.prisma')

// ---------------------------------------------------------------------------
// Create: basic fields + feature flags (broker)
// ---------------------------------------------------------------------------

test('broker create form sends plan basics and feature array (label/enabled/sortOrder)', () => {
  assert.match(brokerNewPage, /\.\.\.form/)
  assert.match(brokerNewPage, /price: Math\.round\(Number\(form\.price\) \* 100\)/)
  assert.match(brokerNewPage, /displayOrder: Number\(form\.displayOrder\)/)
  assert.match(brokerNewPage, /features\.map/)
})

test('broker create form exposes feature toggles, editable labels, and sort orders', () => {
  assert.match(brokerNewPage, /features\.map/)
  assert.match(brokerNewPage, /Switch/)
  assert.match(brokerNewPage, /updateFeature/)
  assert.match(brokerNewPage, /label/)
})

test('broker feature metadata is display-only (label/enabled/sortOrder, no entitlement codes)', () => {
  // The feature catalog is now a simple array of display drafts with label/enabled/sortOrder.
  assert.ok(DEFAULT_BROKER_PLAN_FEATURES.FREE.length > 0)
  for (const feature of DEFAULT_BROKER_PLAN_FEATURES.FREE) {
    assert.ok(typeof feature.label === 'string' && feature.label.length > 0)
    assert.ok(typeof feature.enabled === 'boolean')
    assert.ok(typeof feature.sortOrder === 'number')
  }
})

test('broker features carry enabled, display label, and sort order (no quota limits introduced)', () => {
  const brokerPlan = schema.slice(schema.indexOf('model BrokerSubscriptionPlanFeature'), schema.indexOf('model BrokerRegistration'))
  assert.match(brokerPlan, /enabled\s+Boolean/)
  assert.match(brokerPlan, /label\s+String/)
  assert.match(brokerPlan, /sortOrder\s+Int/)
  assert.doesNotMatch(brokerPlan, /limit|quota|max/)
})

// ---------------------------------------------------------------------------
// Create: validation (broker API)
// ---------------------------------------------------------------------------

test('broker create API requires a stable unique code', () => {
  assert.match(brokerCreateApi, /normalizePlanCode\(body\.code\)/)
  assert.match(brokerCreateApi, /A plan with this code already exists/)
})

test('broker create API enforces paid plans must reference Stripe Product and Price', () => {
  assert.match(brokerCreateApi, /Paid plans require a Stripe Product ID and a Stripe Price ID\./)
})

test('broker create API sends feature array with optional id, label, enabled, sortOrder', () => {
  assert.match(brokerCreateApi, /sanitizeFeatureDrafts/)
  assert.match(brokerCreateApi, /features: /)
})

test('broker create API allowlists billing interval and lowercases currency', () => {
  assert.match(brokerCreateApi, /\['day', 'week', 'month', 'year'\]/)
  assert.match(brokerCreateApi, /body\.currency\.trim\(\)\.toLowerCase\(\)/)
  assert.match(brokerCreateApi, /body\.isActive === true/)
})

test('broker create API accepts only the fixed supported plans (FREE/FEATURED)', () => {
  assert.match(brokerCreateApi, /isSupportedBrokerPlanCode/)
  assert.match(brokerCreateApi, /Only FREE and FEATURED plans are supported/)
  assert.match(brokerCreateApi, /Unsupported plan/)
})

test('broker create API derives the name from the fixed plan identity (no arbitrary name)', () => {
  assert.match(brokerCreateApi, /getBrokerPlanDisplayName/)
  assert.match(brokerCreateApi, /Plan name is derived from the fixed plan identity and cannot be changed/)
  assert.doesNotMatch(brokerCreateApi, /Plan name must be 100 characters or fewer/)
})

test('broker update API rejects changing plan identity (FREE<->FEATURED)', () => {
  assert.match(brokerDetailApi, /Plan identity cannot be changed/)
  assert.doesNotMatch(brokerDetailApi, /data\.code = code/)
})

test('broker create form uses a fixed plan selector instead of free-text name/code fields', () => {
  assert.doesNotMatch(brokerNewPage, /label="Name"/)
  assert.doesNotMatch(brokerNewPage, /label="Code"/)
  assert.match(brokerNewPage, /Select a fixed plan to create/)
})

test('broker edit form shows plan identity as read-only', () => {
  assert.match(brokerDetailPage, /Plan identity and customer-facing name are fixed and cannot be changed/)
  assert.doesNotMatch(brokerDetailPage, /onChange=\{\(e\) => setField\('name'/)
  assert.doesNotMatch(brokerDetailPage, /onChange=\{\(e\) => setField\('code'/)
})

test('broker admin APIs reject non-admin callers', () => {
  assert.match(brokerCreateApi, /isAdmin\(\)|role !== 'ADMIN'|status: 403/)
  assert.match(brokerDetailApi, /isAdmin\(\)|role !== 'ADMIN'|status: 403/)
})

// ---------------------------------------------------------------------------
// Edit: parity with create (price unit + features)
// ---------------------------------------------------------------------------

test('broker edit form loads price in USD and saves back in cents (create/edit parity)', () => {
  assert.match(brokerDetailPage, /price: data\.plan\.price \/ 100/)
  assert.match(brokerDetailPage, /price: Math\.round\(plan\.price \* 100\)/)
  assert.match(brokerDetailPage, /Price \(USD\)/)
})

test('broker edit form toggles and updates feature array rows by index', () => {
  assert.match(brokerDetailPage, /updateFeature/)
  assert.match(brokerDetailPage, /const features = \[\.\.\.plan\.features\]/)
})

test('broker edit form surfaces a load-error state instead of hanging on loading', () => {
  assert.match(brokerDetailPage, /loadError/)
  assert.match(brokerDetailPage, /Unable to load plan/)
  assert.match(brokerDetailPage, /Retry/)
})

test('broker edit form validates the same interval options as create', () => {
  assert.match(brokerNewPage, /<option value="day">day<\/option>/)
  assert.match(brokerDetailPage, /<option value="day">day<\/option>/)
})

test('broker PATCH guards the free-to-paid transition without a Stripe mapping', () => {
  assert.match(brokerDetailApi, /Paid plans require a Stripe Product ID and a Stripe Price ID\./)
  assert.match(brokerDetailApi, /resultingPrice > 0 && plan\.price <= 0/)
})

test('broker PATCH lowercases currency and allowlists billing interval', () => {
  assert.match(brokerDetailApi, /body\.currency\.trim\(\)\.toLowerCase\(\)/)
  assert.match(brokerDetailApi, /\['day', 'week', 'month', 'year'\]/)
})

test('broker list page renders feature label array (no feature codes)', () => {
  assert.match(brokerListPage, /features: /)
  assert.doesNotMatch(brokerListPage, /brokerFeatureLabel/)
})

// ---------------------------------------------------------------------------
// Company advertising: partial updates (activate/deactivate must work)
// ---------------------------------------------------------------------------

test('company PATCH supports partial updates without requiring the full plan payload', () => {
  // A toggle-only request ({ isActive }) must not fail for a missing name.
  assert.match(companyDetailApi, /Partial update: only fields present in the body are applied/)
  assert.match(companyDetailApi, /body\.isActive !== undefined/)
  assert.match(companyDetailApi, /update\.isActive = body\.isActive === true/)
  assert.match(companyDetailApi, /update\.name !== undefined && update\.name !== plan\.name/)
})

test('company PATCH never resets an omitted price to zero', () => {
  assert.match(companyDetailApi, /nextPrice = update\.price !== undefined \? update\.price : plan\.price/)
})

test('company PATCH preserves the active-subscription Stripe-change guard', () => {
  assert.match(companyDetailApi, /hasActiveSubscriptions > 0 && stripeMappingChanged/)
  assert.match(companyDetailApi, /stripeMappingChanged/)
})

test('company admin APIs reject non-admin callers', () => {
  assert.match(companyCreateApi, /role !== 'ADMIN'/)
  assert.match(companyDetailApi, /role !== 'ADMIN'/)
})

test('company edit form keeps price parity with the create form', () => {
  assert.match(companyDetailPage, /price: data\.plan\.price \/ 100/)
  assert.match(companyDetailPage, /price: Math\.round\(plan\.price \* 100\)/)
  assert.match(companyDetailPage, /Price \(USD\)/)
  assert.match(companyNewPage, /price: Math\.round\(Number\(form\.price\) \* 100\)/)
})

test('company create form allows day/week/month/year billing intervals', () => {
  assert.match(companyNewPage, /<option value="day">day<\/option>/)
  assert.match(companyNewPage, /<option value="week">week<\/option>/)
  assert.match(companyNewPage, /<option value="year">year<\/option>/)
})

// ---------------------------------------------------------------------------
// No duplicate admin management surface for company advertising plans
// ---------------------------------------------------------------------------

test('legacy duplicate company advertising plans page is removed', () => {
  assert.equal(exists('app/admin/company-advertising-plans/page.tsx'), false)
})

test('admin navigation points company advertising plans to the canonical route', () => {
  assert.match(navigation, /'Advertising Plans', href: '\/admin\/billing\/company-advertising-plans'/)
  assert.doesNotMatch(navigation, /href: '\/admin\/company-advertising-plans'/)
})

test('company advertising plan collection route exposes no PATCH handler', () => {
  assert.doesNotMatch(companyCreateApi, /export async function PATCH/)
})

// ---------------------------------------------------------------------------
// Product separation
// ---------------------------------------------------------------------------

test('broker plan forms never reference company advertising models', () => {
  assert.doesNotMatch(brokerNewPage + brokerDetailPage, /CompanyAdvertisingPlan/)
})

test('company plan routes never reference broker plan models', () => {
  assert.doesNotMatch(companyCreateApi + companyDetailApi, /BrokerSubscriptionPlan|BrokerSubscription/)
})

test('broker and company plan models remain distinct in the schema', () => {
  assert.match(schema, /model BrokerSubscriptionPlan \{/)
  assert.match(schema, /model CompanyAdvertisingPlan \{/)
  const brokerPlan = schema.slice(schema.indexOf('model BrokerSubscriptionPlan'), schema.indexOf('model BrokerSubscriptionPlanFeature'))
  assert.doesNotMatch(brokerPlan, /CompanyAdvertisingPlan/)
  const companyPlan = schema.slice(schema.indexOf('model CompanyAdvertisingPlan'), schema.indexOf('model CompanyAdRequest'))
  assert.doesNotMatch(companyPlan, /BrokerSubscriptionPlan/)
})

// ---------------------------------------------------------------------------
// Backward compatibility
// ---------------------------------------------------------------------------

test('existing broker plans remain editable: paid plans without Stripe IDs are not force-blocked', () => {
  // The PATCH guard only triggers on a FREE→paid transition, not on edits to an
  // existing paid plan that has not yet been connected to Stripe.
  assert.match(brokerDetailApi, /plan\.price <= 0/)
  assert.doesNotMatch(brokerDetailApi, /resultingPrice > 0 && \(!resultingProductId \|\| !resultingPriceId\)\)\s*\n\s*\{\s*\n\s*return/)
})

test('deactivating a plan never touches subscriptions (broker and company)', () => {
  assert.doesNotMatch(brokerDetailApi, /subscription\.updateMany/)
  assert.doesNotMatch(companyDetailApi, /companySubscription\.updateMany/)
})
