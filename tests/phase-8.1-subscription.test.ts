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

test('initial dynamic plans are FREE, FEATURED, PREMIUM with no PRO', () => {
  assert.deepEqual(DEFAULT_BROKER_PLANS.map((plan) => plan.code), ['FREE', 'FEATURED', 'PREMIUM'])
  assert.doesNotMatch(DEFAULT_BROKER_PLANS.map((plan) => plan.code).join(' '), /PRO/)
})

test('initial dynamic feature configuration matches the product', () => {
  assert.deepEqual(DEFAULT_BROKER_PLAN_FEATURES.FREE, { PROFILE_BADGE: false, SUPPORT_TICKETS: false })
  assert.deepEqual(DEFAULT_BROKER_PLAN_FEATURES.FEATURED, { PROFILE_BADGE: true, SUPPORT_TICKETS: true })
  assert.deepEqual(DEFAULT_BROKER_PLAN_FEATURES.PREMIUM, { PROFILE_BADGE: true, SUPPORT_TICKETS: true })
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