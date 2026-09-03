import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {
  DEFAULT_BROKER_PLAN_FEATURES,
  DEFAULT_BROKER_PLANS,
  brokerSubscriptionHasProfileBadge,
  normalizePlanCode,
} from '../lib/broker-plans'

const read = (path: string) => fs.readFileSync(path, 'utf8')
const schema = read('prisma/schema.prisma')
const listRoute = read('app/api/admin/broker-plans/route.ts')
const detailRoute = read('app/api/admin/broker-plans/[id]/route.ts')
const plansApi = read('app/api/subscription/plans/route.ts')
const checkoutRoute = read('app/api/subscription/checkout/route.ts')
const reconcile = read('scripts/reconcile-broker-plans.ts')
const plansLib = read('lib/broker-plans.ts')
const brokerPage = read('app/broker/subscription/page.tsx')
const clientHook = read('hooks/useClient.ts')

// ---------------------------------------------------------------------------
// Initial plans exist
// ---------------------------------------------------------------------------

test('FREE, FEATURED, and PREMIUM plans are seeded by the reconcile script', () => {
  const codes = DEFAULT_BROKER_PLANS.map((plan) => plan.code)
  assert.deepEqual(codes, ['FREE', 'FEATURED', 'PREMIUM'])
})

test('FREE does not list the Mortgage Expert badge; FEATURED does (display-only)', () => {
  const labels = (code: string) => DEFAULT_BROKER_PLAN_FEATURES[code].map((f) => f.label)
  const badgeLabel = 'Mortgage Expert Badge + 5 Green Stars'
  assert.equal(labels('FREE').includes(badgeLabel), false)
  assert.equal(labels('FEATURED').includes(badgeLabel), true)
})

test('FREE plan has no Stripe mapping and zero price', () => {
  const free = DEFAULT_BROKER_PLANS.find((plan) => plan.code === 'FREE')!
  assert.equal(free.price, 0)
})

test('feature rows are display-only (label/enabled/sortOrder) and the badge derives from plan tier', () => {
  for (const plan of DEFAULT_BROKER_PLANS) {
    for (const feature of plan.features) {
      assert.ok(typeof feature.label === 'string' && feature.label.length > 0)
      assert.ok(typeof feature.enabled === 'boolean')
      assert.ok(typeof feature.sortOrder === 'number')
    }
  }
})

// ---------------------------------------------------------------------------
// Entitlement
// ---------------------------------------------------------------------------

test('badge entitlement is derived from the paid plan tier', () => {
  const sub = (plan: string, isActive = true, endDate: Date | null = null) => ({ plan, isActive, endDate })
  assert.equal(brokerSubscriptionHasProfileBadge(sub('FEATURED')), true)
  assert.equal(brokerSubscriptionHasProfileBadge(sub('PREMIUM')), true)
  assert.equal(brokerSubscriptionHasProfileBadge(sub('FREE')), false)
})

test('inactive or expired subscriptions do not grant the badge', () => {
  const active = { plan: 'FEATURED', isActive: true, endDate: null }
  const inactive = { ...active, isActive: false }
  const expired = { ...active, endDate: new Date(Date.now() - 1000) }
  assert.equal(brokerSubscriptionHasProfileBadge(active), true)
  assert.equal(brokerSubscriptionHasProfileBadge(inactive), false)
  assert.equal(brokerSubscriptionHasProfileBadge(expired), false)
})

// ---------------------------------------------------------------------------
// Admin CRUD routes
// ---------------------------------------------------------------------------

test('admin plan routes enforce ADMIN authorization', () => {
  assert.match(listRoute, /admin\?\.role !== 'ADMIN'|user\?\.role === 'ADMIN'|isAdmin\(\)/)
  assert.match(listRoute, /status: 403/)
  assert.match(detailRoute, /status: 403/)
})

test('admin plan create validates a stable plan code', () => {
  assert.match(listRoute, /normalizePlanCode/)
})

test('used plans cannot be hard deleted', () => {
  assert.match(detailRoute, /_count: \{ select: \{ subscriptions: true \} \}/)
  assert.match(detailRoute, /This plan has active or historical subscriptions\. Deactivate it instead\./)
  assert.match(detailRoute, /status: 409/)
})

test('unused plans can be deleted', () => {
  assert.match(detailRoute, /brokerSubscriptionPlan\.delete/)
})

test('admin plan routes validate Stripe identifiers and never return secrets', () => {
  assert.match(listRoute, /validateStripeProductId/)
  assert.match(listRoute, /validateStripePriceId/)
  assert.match(detailRoute, /validateStripeProductId/)
  assert.doesNotMatch(listRoute, /STRIPE_SECRET_KEY/)
  assert.doesNotMatch(detailRoute, /STRIPE_SECRET_KEY/)
})

// ---------------------------------------------------------------------------
// Stripe checkout safety
// ---------------------------------------------------------------------------

test('checkout resolves the plan from the database by code + price', () => {
  assert.match(checkoutRoute, /validateBrokerPlanForCheckout/)
})

test('public plans API reads from the database', () => {
  assert.match(plansApi, /listBrokerPlans/)
  assert.doesNotMatch(plansApi, /subscriptionPlans from '@\/lib\/stripe'/)
})

test('broker subscription page uses the canonical singular plans endpoint (no 404 plural route)', () => {
  assert.match(brokerPage, /\/api\/subscription\/plans/)
  assert.doesNotMatch(brokerPage, /\/api\/subscriptions\/plans/)
})

test('client subscription-plans hook uses the canonical singular plans endpoint', () => {
  assert.match(clientHook, /\/api\/subscription\/plans/)
  assert.doesNotMatch(clientHook, /\/api\/subscriptions\/plans/)
})

test('public plans API returns only broker plans and never CompanyAdvertisingPlan', () => {
  assert.match(plansApi, /listBrokerPlansPublic/)
  assert.doesNotMatch(plansApi, /CompanyAdvertisingPlan/)
  assert.doesNotMatch(plansApi, /STRIPE_SECRET_KEY/)
})

test('public plans API excludes inactive plans via the active-only query', () => {
  assert.match(plansLib, /isActive: true/)
})

test('admin plan update blocks changing Stripe mapping while active subscriptions exist', () => {
  assert.match(detailRoute, /Changing its Stripe price\/product would break active billing/)
  assert.match(detailRoute, /status: 409/)
})

test('admin plan update blocks deactivation while active subscriptions exist', () => {
  assert.match(detailRoute, /Deactivate those subscriptions before deactivating the plan/)
  assert.match(detailRoute, /status: 409/)
})

test('checkout never consults CompanyAdvertisingPlan', () => {
  assert.match(checkoutRoute, /validateBrokerPlanForCheckout/)
  assert.doesNotMatch(checkoutRoute, /CompanyAdvertisingPlan/)
  assert.match(checkoutRoute, /ownerType: 'BROKER'/)
})

// ---------------------------------------------------------------------------
// Data reconciliation
// ---------------------------------------------------------------------------

test('reconcile script is idempotent and links existing subscriptions', () => {
  assert.match(reconcile, /findUnique\(\{ where: \{ code: planInput\.code \} \}\)/)
  assert.match(reconcile, /planId/)
  assert.doesNotMatch(reconcile, /\.delete/)
})

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

test('BrokerSubscription links to the DB plan and drops the enum source of truth', () => {
  assert.match(schema, /plan\s+String/)
  assert.match(schema, /planId\s+String\?\s+@db\.ObjectId/)
  assert.match(schema, /planRef\s+BrokerSubscriptionPlan\?/)
})

test('plan code is unique and feature rows are display-only keyed by planId', () => {
  assert.match(schema, /code\s+String\s+@unique/)
  assert.match(schema, /@@index\(\[planId\]\)/)
  assert.doesNotMatch(schema, /@@unique\(\[planId, code\]\)/)
})

test('normalizePlanCode produces a stable uppercase code', () => {
  assert.equal(normalizePlanCode(' featured '), 'FEATURED')
  assert.equal(normalizePlanCode('my plan'), 'MY_PLAN')
  assert.equal(normalizePlanCode(''), null)
})