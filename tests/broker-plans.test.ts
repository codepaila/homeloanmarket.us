import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {
  ALL_BROKER_PLAN_FEATURES,
  BROKER_PLAN_FEATURES,
  DEFAULT_BROKER_PLAN_FEATURES,
  DEFAULT_BROKER_PLANS,
  brokerSubscriptionHasFeature,
  normalizePlanCode,
  planHasFeature,
} from '../lib/broker-plans'

const read = (path: string) => fs.readFileSync(path, 'utf8')
const schema = read('prisma/schema.prisma')
const listRoute = read('app/api/admin/broker-plans/route.ts')
const detailRoute = read('app/api/admin/broker-plans/[id]/route.ts')
const plansApi = read('app/api/subscription/plans/route.ts')
const checkoutRoute = read('app/api/subscription/checkout/route.ts')
const reconcile = read('scripts/reconcile-broker-plans.ts')
const plansLib = read('lib/broker-plans.ts')

// ---------------------------------------------------------------------------
// Initial plans exist
// ---------------------------------------------------------------------------

test('FREE, FEATURED, and PREMIUM plans are seeded by the reconcile script', () => {
  const codes = DEFAULT_BROKER_PLANS.map((plan) => plan.code)
  assert.deepEqual(codes, ['FREE', 'FEATURED', 'PREMIUM'])
})

test('FREE has no badge and no support tickets; paid plans have both', () => {
  assert.deepEqual(DEFAULT_BROKER_PLAN_FEATURES.FREE, { PROFILE_BADGE: false, SUPPORT_TICKETS: false })
  assert.deepEqual(DEFAULT_BROKER_PLAN_FEATURES.FEATURED, { PROFILE_BADGE: true, SUPPORT_TICKETS: true })
  assert.deepEqual(DEFAULT_BROKER_PLAN_FEATURES.PREMIUM, { PROFILE_BADGE: true, SUPPORT_TICKETS: true })
})

test('FREE plan has no Stripe mapping and zero price', () => {
  const free = DEFAULT_BROKER_PLANS.find((plan) => plan.code === 'FREE')!
  assert.equal(free.price, 0)
})

test('feature codes are stable and exactly the initial set', () => {
  assert.deepEqual(ALL_BROKER_PLAN_FEATURES, ['PROFILE_BADGE', 'SUPPORT_TICKETS'])
  assert.equal(BROKER_PLAN_FEATURES.PROFILE_BADGE, 'PROFILE_BADGE')
  assert.equal(BROKER_PLAN_FEATURES.SUPPORT_TICKETS, 'SUPPORT_TICKETS')
})

// ---------------------------------------------------------------------------
// Entitlement
// ---------------------------------------------------------------------------

test('PROFILE_BADGE entitlement is derived from the plan feature rows', () => {
  const withBadge = { features: [{ code: 'PROFILE_BADGE', enabled: true }] }
  const withoutBadge = { features: [{ code: 'PROFILE_BADGE', enabled: false }] }
  assert.equal(planHasFeature(withBadge, 'PROFILE_BADGE'), true)
  assert.equal(planHasFeature(withoutBadge, 'PROFILE_BADGE'), false)
})

test('SUPPORT_TICKETS entitlement works independently', () => {
  const plan = { features: [{ code: 'SUPPORT_TICKETS', enabled: true }, { code: 'PROFILE_BADGE', enabled: false }] }
  assert.equal(planHasFeature(plan, 'SUPPORT_TICKETS'), true)
  assert.equal(planHasFeature(plan, 'PROFILE_BADGE'), false)
})

test('an admin feature toggle changes entitlement', () => {
  assert.equal(planHasFeature({ features: [{ code: 'PROFILE_BADGE', enabled: true }] }, 'PROFILE_BADGE'), true)
  assert.equal(planHasFeature({ features: [{ code: 'PROFILE_BADGE', enabled: false }] }, 'PROFILE_BADGE'), false)
})

test('inactive or expired subscriptions do not grant features', () => {
  const active = { plan: 'FEATURED', isActive: true, endDate: null, planRef: { features: [{ code: 'PROFILE_BADGE', enabled: true }] } }
  const inactive = { ...active, isActive: false }
  const expired = { ...active, endDate: new Date(Date.now() - 1000) }
  assert.equal(brokerSubscriptionHasFeature(active, 'PROFILE_BADGE'), true)
  assert.equal(brokerSubscriptionHasFeature(inactive, 'PROFILE_BADGE'), false)
  assert.equal(brokerSubscriptionHasFeature(expired, 'PROFILE_BADGE'), false)
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

test('plan code is unique and feature rows are normalized', () => {
  assert.match(schema, /code\s+String\s+@unique/)
  assert.match(schema, /@@unique\(\[planId, code\]\)/)
})

test('normalizePlanCode produces a stable uppercase code', () => {
  assert.equal(normalizePlanCode(' featured '), 'FEATURED')
  assert.equal(normalizePlanCode('my plan'), 'MY_PLAN')
  assert.equal(normalizePlanCode(''), null)
})