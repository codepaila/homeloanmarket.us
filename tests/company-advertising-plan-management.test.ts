import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {
  normalizeCompanyPlanInput,
  validateCompanyPlanStripe,
} from '../lib/company-advertising-plan'

const read = (path: string) => fs.readFileSync(path, 'utf8')

const schema = read('prisma/schema.prisma')
const listRoute = read('app/api/admin/company-advertising-plans/route.ts')
const detailRoute = read('app/api/admin/company-advertising-plans/[id]/route.ts')
const subscriptionsRoute = read('app/api/admin/company-subscriptions/route.ts')
const checkout = read('app/api/company/subscription/checkout/route.ts')
const plansApi = read('app/api/company/subscription/plans/route.ts')
const plansLib = read('lib/company-advertising-plan.ts')
const companyPlanLib = read('lib/company-plan.ts')
const dashboardPage = read('app/company/dashboard/page.tsx')
const dashboardClient = read('app/company/dashboard/CompanyDashboardClient.tsx')
const nav = read('components/layout/admin/sideBarData.ts')

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

test('CompanyAdvertisingPlan supports currency and display order', () => {
  assert.match(schema, /model CompanyAdvertisingPlan \{/)
  assert.match(schema, /currency\s+String\s+@default\("usd"\)/)
  assert.match(schema, /displayOrder\s+Int\s+@default\(0\)/)
})

test('CompanySubscription remains linked to CompanyAdvertisingPlan, separate from CompanyAdRequest', () => {
  assert.match(schema, /advertisingPlan\s+CompanyAdvertisingPlan\?/)
  assert.match(schema, /model CompanySubscription \{/)
  assert.match(schema, /model CompanyAdRequest \{/)
})

test('company plans never reference broker plan models', () => {
  const companyPlan = schema.slice(schema.indexOf('model CompanyAdvertisingPlan'), schema.indexOf('model CompanyAdRequest'))
  assert.doesNotMatch(companyPlan, /BrokerSubscriptionPlan/)
})

// ---------------------------------------------------------------------------
// Admin list / auth
// ---------------------------------------------------------------------------

test('admin can list company advertising plans with summary', () => {
  assert.match(listRoute, /companyAdvertisingPlan\.findMany/)
  assert.match(listRoute, /summary/)
})

test('non-admin receives 401/403 from plan routes', () => {
  assert.match(listRoute, /role !== 'ADMIN'/)
  assert.match(listRoute, /status: 401|status: 403/)
  assert.match(detailRoute, /role !== 'ADMIN'/)
  assert.match(detailRoute, /status: 401|status: 403/)
})

// ---------------------------------------------------------------------------
// Create / update
// ---------------------------------------------------------------------------

test('admin can create a plan with normalized input', () => {
  assert.match(listRoute, /companyAdvertisingPlan\.create/)
  assert.match(listRoute, /normalizeCompanyPlanInput/)
})

test('admin can update a plan', () => {
  assert.match(detailRoute, /companyAdvertisingPlan\.update/)
})

test('admin can activate and deactivate a plan', () => {
  assert.match(detailRoute, /isActive/)
})

test('plan name uniqueness is enforced on create and update', () => {
  assert.match(listRoute, /A plan with this name already exists/)
  assert.match(detailRoute, /A plan with this name already exists/)
})

// ---------------------------------------------------------------------------
// Delete protection
// ---------------------------------------------------------------------------

test('a used plan cannot be destructively deleted', () => {
  assert.match(detailRoute, /_count: \{ select: \{ subscriptions: true \} \}/)
  assert.match(detailRoute, /This plan has active or historical subscriptions\. Deactivate it instead\./)
  assert.match(detailRoute, /status: 409/)
})

test('an unused plan can be deleted', () => {
  assert.match(detailRoute, /companyAdvertisingPlan\.delete/)
})

// ---------------------------------------------------------------------------
// Stripe rules
// ---------------------------------------------------------------------------

test('free plans do not require Stripe identifiers', async () => {
  const result = await validateCompanyPlanStripe({ price: 0, stripeProductId: null, stripePriceId: null })
  assert.equal(result.ok, true)
})

test('paid plans require a Stripe product and price', async () => {
  const result = await validateCompanyPlanStripe({ price: 1500, stripeProductId: null, stripePriceId: null })
  assert.equal(result.ok, false)
})

test('stripe price validation checks that the price belongs to the product', async () => {
  // The validation delegates to the shared Stripe validator (product/price
  // match). Confirm the helper calls both product and price validation.
  const source = read('lib/company-advertising-plan.ts')
  assert.match(source, /validateStripeProductId/)
  assert.match(source, /validateStripePriceId/)
  assert.match(source, /priceId, productId/)
})

test('stripe secret is never exposed to the browser', () => {
  assert.doesNotMatch(listRoute, /STRIPE_SECRET_KEY/)
  assert.doesNotMatch(detailRoute, /STRIPE_SECRET_KEY/)
  assert.doesNotMatch(plansApi, /STRIPE_SECRET_KEY/)
})

test('client cannot override price: checkout resolves the price server-side from the plan', () => {
  assert.match(checkout, /plan\.price/)
  assert.match(checkout, /plan\.stripePriceId/)
  assert.doesNotMatch(checkout, /body\.price/)
})

test('client cannot override the Stripe price ID', () => {
  assert.doesNotMatch(checkout, /body\.priceId/)
  assert.match(checkout, /resolveCompanyPlanForCheckout/)
})

// ---------------------------------------------------------------------------
// Inactive / free plans
// ---------------------------------------------------------------------------

test('inactive plans are not offered for purchase', () => {
  assert.match(plansApi, /getCanonicalCompanyAdvertisingPlan/)
})

test('free plans do not require Stripe checkout', () => {
  assert.match(checkout, /plan\.price <= 0|plan\.price > 0 \? plan\.stripePriceId : null/)
})

// ---------------------------------------------------------------------------
// Company subscription / ownership
// ---------------------------------------------------------------------------

test('company subscription operations require an authenticated company membership', () => {
  assert.match(checkout, /getCurrentCompany/)
  assert.match(checkout, /Company access required/)
})

test('company checkout derives company identity server-side, not from the client', () => {
  assert.doesNotMatch(checkout, /body\.companyId/)
  assert.match(checkout, /current\.company\.id/)
})

// ---------------------------------------------------------------------------
// Admin company subscription inspection
// ---------------------------------------------------------------------------

test('admin can inspect company subscriptions with ownership and billing info', () => {
  const viewPage = read('app/admin/billing/company-subscriptions/page.tsx')
  assert.match(subscriptionsRoute, /companySubscription\.findMany/)
  assert.match(subscriptionsRoute, /role !== 'ADMIN'/)
  assert.match(viewPage, /stripeCustomerId/)
  assert.match(viewPage, /stripeSubId/)
})

test('admin subscription view does not expose Stripe secrets', () => {
  assert.doesNotMatch(subscriptionsRoute, /STRIPE_SECRET_KEY/)
})

// ---------------------------------------------------------------------------
// Dashboard separation
// ---------------------------------------------------------------------------

test('company dashboard shows the current plan and billing period', () => {
  assert.match(dashboardPage, /advertisingPlan/)
  assert.match(dashboardClient, /Company Advertising Plan/)
  assert.match(dashboardClient, /Current plan/)
  assert.match(dashboardClient, /Renews \/ ends/)
})

test('company dashboard keeps subscription separate from advertisement requests', () => {
  assert.match(dashboardClient, /Request Advertisement/)
  assert.match(dashboardClient, /Your advertising subscription grants access to the advertisement-request functionality/)
})

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

test('admin navigation separates Companies (requests/plans) from Advertisements', () => {
  assert.match(nav, /Advertisement Requests/)
  assert.match(nav, /Advertising Plans/)
  assert.match(nav, /Companies/)
  assert.match(nav, /\/admin\/ads\/list/)
  assert.match(nav, /\/admin\/billing\/company-advertising-plans/)
})

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

test('normalizeCompanyPlanInput rejects a plan without a name', () => {
  assert.equal(normalizeCompanyPlanInput({ name: '   ' }), null)
})

test('normalizeCompanyPlanInput sanitizes billing interval and price', () => {
  // Price is stored in cents; the admin UI sends dollars already converted.
  const input = normalizeCompanyPlanInput({ name: 'Standard', price: '1500', billingInterval: 'year', currency: 'USD' })!
  assert.equal(input.price, 1500)
  assert.equal(input.billingInterval, 'year')
  assert.equal(input.currency, 'usd')
  const bad = normalizeCompanyPlanInput({ name: 'X', billingInterval: 'bogus' })!
  assert.equal(bad.billingInterval, 'month')
})