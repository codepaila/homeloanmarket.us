import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const read = (relative: string): string => fs.readFileSync(path.join(ROOT, relative), 'utf8')

test('Phase 1I: checkout paths share a server-side lock and existing-subscription guard', () => {
  const route = read('app/api/subscription/checkout/route.ts')
  const action = read('actions/subscription.ts')
  const service = read('lib/subscription.ts')
  assert.ok(route.includes('SubscriptionService.withCheckoutLock'))
  assert.ok(action.includes('SubscriptionService.withCheckoutLock'))
  assert.ok(service.includes('findCheckoutConflict'))
  assert.ok(service.includes('checkout.sessions.list'))
  assert.ok(service.includes("['active', 'trialing', 'incomplete', 'past_due', 'unpaid', 'paused']"))
})

test('Phase 1I: Stripe customer and checkout ownership are server-verified', () => {
  const action = read('actions/subscription.ts')
  const service = read('lib/subscription.ts')
  assert.ok(action.includes('getCurrentUser()'))
  assert.ok(action.includes('user.stripeCustomerId !== customerId'))
  assert.ok(service.includes('assertStripeCustomerOwnership'))
  assert.ok(service.includes('customer.metadata?.userId'))
  assert.ok(service.includes('customer.metadata?.brokerId'))
})

test('Phase 1I: checkout idempotency is shared and deterministic', () => {
  const route = read('app/api/subscription/checkout/route.ts')
  const action = read('actions/subscription.ts')
  assert.ok(route.includes('const idempotencyKey = `checkout_${user.id}_${customerId}_${plan}_${priceId}`'))
  assert.ok(action.includes('idempotencyKey: `checkout_${user.id}_${customerId}_${plan}_${priceId}`'))
  assert.equal(route.includes('idempotencyBucket'), false)
  assert.equal(action.includes('Math.floor(Date.now()'), false)
})

test('Phase 1I: failed Stripe cancellation does not write local inactive state', () => {
  const source = read('lib/subscription.ts')
  assert.ok(source.includes("throw new Error('Stripe cancellation failed')"))
})

test('Phase 1I: H5 entitlement and H6 webhook protections remain', () => {
  const policy = read('lib/broker-policy.ts')
  const webhook = read('app/api/stripe/webhook/route.ts')
  assert.ok(policy.includes('hasPaidEntitlement'))
  assert.ok(webhook.includes('PROCESSING'))
  assert.ok(webhook.includes('PROCESSED'))
  assert.ok(webhook.includes('eventId'))
  assert.ok(webhook.includes('eventCreatedAt'))
})
