import assert from 'node:assert/strict'
import test from 'node:test'
import { getAuthoritativePlan, validatePlanPrice } from '../lib/stripe'
import { SubscriptionService, getPlanForStripePrice } from '../lib/subscription'
import { subscriptionPlans } from '../lib/stripe'

test('server plan catalog accepts only configured plan/price pairs', () => {
  assert.deepEqual(subscriptionPlans.map((plan) => plan.name), ['FREE', 'FEATURED'])
  const featured = getAuthoritativePlan('FEATURED')
  assert.ok(featured)
  assert.equal(validatePlanPrice('FEATURED', featured?.stripePriceId)?.name, 'FEATURED')
  assert.equal(validatePlanPrice('FEATURED', 'tampered-price'), null)
  assert.equal(validatePlanPrice('UNKNOWN', 'price'), null)
  assert.equal(validatePlanPrice('FREE', ''), null)
})

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

test('provider prices resolve only to FREE or FEATURED', () => {
  const featured = getAuthoritativePlan('FEATURED')
  assert.equal(getPlanForStripePrice(featured?.stripePriceId), 'FEATURED')
  assert.equal(getPlanForStripePrice('unknown-provider-price'), 'FREE')
  assert.equal(getPlanForStripePrice('price_PREMIUM'), 'FREE')
})
