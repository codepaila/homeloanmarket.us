import assert from 'node:assert/strict'
import test from 'node:test'
import { hasPaidEntitlement } from '../lib/broker-policy'
import { SubscriptionService } from '../lib/subscription'

test('dashboard entitlement boundaries preserve FREE and FEATURED semantics', () => {
  assert.equal(hasPaidEntitlement({ plan: 'FREE', isActive: true }), false)
  assert.equal(hasPaidEntitlement({ plan: 'FEATURED', isActive: true }), true)
  assert.equal(hasPaidEntitlement({ plan: 'FEATURED', isActive: true, endDate: new Date(Date.now() - 1) }), false)
  assert.equal(SubscriptionService.effectiveSubscription({ plan: 'FEATURED', isActive: false }).plan, 'FREE')
  assert.equal(SubscriptionService.effectiveSubscription(null).plan, 'FREE')
})

test('unsupported dashboard entitlement state is FREE-safe', () => {
  assert.equal(SubscriptionService.effectiveSubscription({ plan: 'PREMIUM', isActive: true }).plan, 'FREE')
})
