import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { SubscriptionService } from '../lib/subscription'
import { DEFAULT_BROKER_PLANS, DEFAULT_BROKER_PLAN_FEATURES } from '../lib/broker-plans'

const subscriptionSource = fs.readFileSync('lib/subscription.ts', 'utf8')
const stripeSource = fs.readFileSync('lib/stripe.ts', 'utf8')

test('effective entitlement consistently falls back to active FREE', () => {
  assert.equal(SubscriptionService.effectiveSubscription(null).plan, 'FREE')
  assert.equal(SubscriptionService.effectiveSubscription(null).isActive, true)
  assert.equal(SubscriptionService.effectiveSubscription({ plan: 'PREMIUM', isActive: false }).plan, 'FREE')
  assert.equal(SubscriptionService.effectiveSubscription({ plan: 'FEATURED', isActive: true }).plan, 'FEATURED')
  assert.equal(
    SubscriptionService.effectiveSubscription({ plan: 'FEATURED', isActive: true, endDate: new Date(Date.now() - 1) }).plan,
    'FREE',
  )
})

test('commercial placement calculation does not alter profile policy fields', () => {
  const broker = {
    avgRating: 4,
    totalReviews: 10,
    experienceYears: 4,
    totalLeads: 0,
    leads: [],
  }
  assert.ok(SubscriptionService.calculateFeaturedRank(broker, 'FEATURED') > 0)
  assert.equal(SubscriptionService.calculateFeaturedRank(broker, 'FREE'), 28)
})

test('initial dynamic plans are FREE and FEATURED only, with no PREMIUM and no PRO', () => {
  assert.deepEqual(DEFAULT_BROKER_PLANS.map((plan) => plan.code), ['FREE', 'FEATURED'])
  assert.doesNotMatch(DEFAULT_BROKER_PLANS.map((plan) => plan.code).join(' '), /PREMIUM|PRO/)
})

test('initial dynamic feature configuration matches the product (display-only)', () => {
  const freeLabels = DEFAULT_BROKER_PLAN_FEATURES.FREE.map((f) => f.label)
  const featuredLabels = DEFAULT_BROKER_PLAN_FEATURES.FEATURED.map((f) => f.label)
  // FREE never lists the Mortgage Expert badge; FEATURED does.
  assert.equal(freeLabels.includes('Mortgage Expert Badge + 5 Green Stars'), false)
  assert.equal(featuredLabels.includes('Mortgage Expert Badge + 5 Green Stars'), true)
  // Feature rows are display-only (label/enabled/sortOrder).
  for (const plan of ['FREE', 'FEATURED']) {
    for (const f of DEFAULT_BROKER_PLAN_FEATURES[plan]) {
      assert.ok(typeof f.enabled === 'boolean')
      assert.ok(typeof f.label === 'string' && f.label.length > 0)
      assert.ok(typeof f.sortOrder === 'number')
    }
  }
})

test('subscription service no longer imports the static subscriptionPlans catalog', () => {
  assert.doesNotMatch(subscriptionSource, /from '@\/lib\/stripe'/)
})

test('subscription service resolves plan for Stripe price from the database', () => {
  assert.match(subscriptionSource, /brokerSubscriptionPlan\.findFirst/)
  assert.match(subscriptionSource, /export async function getPlanForStripePrice/)
  assert.doesNotMatch(subscriptionSource, /subscriptionPlans\.find/)
})

test('canUpgrade orders plans by database displayOrder, not a static index', () => {
  assert.match(subscriptionSource, /displayOrder/)
  assert.doesNotMatch(subscriptionSource, /subscriptionPlans\.findIndex/)
})

test('getUsageStats derives plan info from the database, not a static catalog', () => {
  assert.match(subscriptionSource, /listBrokerPlansPublic/)
  assert.doesNotMatch(subscriptionSource, /getAuthoritativePlan/)
})

test('lib/stripe.ts no longer defines the runtime subscription catalog', () => {
  // The static catalog and legacy limit helpers were removed.
  assert.doesNotMatch(stripeSource, /export const subscriptionPlans = \[/)
  assert.doesNotMatch(stripeSource, /maxTeamMembers/)
})