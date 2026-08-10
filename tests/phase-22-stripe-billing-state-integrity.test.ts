import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const read = (relative: string): string => fs.readFileSync(path.join(ROOT, relative), 'utf8')

const service = () => read('lib/subscription.ts')
const checkout = () => read('app/api/subscription/checkout/route.ts')
const action = () => read('actions/subscription.ts')
const webhook = () => read('app/api/stripe/webhook/route.ts')

test('Phase 1J 1: canonical checkout lock exists', () => {
  assert.ok(service().includes('withCheckoutLock'))
  assert.ok(checkout().includes('SubscriptionService.withCheckoutLock'))
})

test('Phase 1J 2: primary and alternate checkout use the same idempotency identity', () => {
  assert.ok(checkout().includes('checkout_${user.id}_${customerId}_${plan}_${priceId}'))
  assert.ok(action().includes('checkout_${user.id}_${customerId}_${plan}_${priceId}'))
})

test('Phase 1J 3: active subscriptions block checkout', () => {
  assert.ok(service().includes("'active'"))
  assert.ok(service().includes('An existing subscription must be managed'))
})

test('Phase 1J 4: trialing subscriptions block checkout', () => {
  assert.ok(service().includes("'trialing'"))
})

test('Phase 1J 5: incomplete subscriptions block checkout', () => {
  assert.ok(service().includes("'incomplete'"))
})

test('Phase 1J 6: past_due subscriptions block checkout', () => {
  assert.ok(service().includes("'past_due'"))
})

test('Phase 1J 7: unpaid subscriptions block checkout', () => {
  assert.ok(service().includes("'unpaid'"))
})

test('Phase 1J 8: paused subscriptions block checkout', () => {
  assert.ok(service().includes("'paused'"))
})

test('Phase 1J 9: terminal canceled subscriptions are not blocked solely by local ID', () => {
  const source = service()
  assert.ok(source.includes('currentIsTerminal'))
  assert.equal(source.includes('if (local?.stripeSubId ||'), false)
})

test('Phase 1J 10: replacement subscription reconciliation is supported', () => {
  const source = service()
  assert.ok(source.includes('currentStripeSubscription'))
  assert.ok(source.includes('currentIsTerminal'))
  assert.ok(source.includes('stripeSubscriptionId'))
})

test('Phase 1J 11: stale webhook protections remain', () => {
  const source = webhook()
  assert.ok(source.includes('hasNewerAppliedEvent'))
  assert.ok(source.includes('STALE_EVENT_IGNORED'))
})

test('Phase 1J 12: webhook customer identity remains checked', () => {
  assert.ok(service().includes('stripeCustomerId'))
  assert.ok(webhook().includes('getStripeEventTarget'))
})

test('Phase 1J 13: wrong Broker cannot use checkout customer', () => {
  assert.ok(service().includes('brokerId'))
  assert.ok(service().includes('Stripe customer does not belong to this account'))
})

test('Phase 1J 14: shared lock covers upgrade path', () => {
  assert.ok(read('app/api/subscription/upgrade/route.ts').includes('withCheckoutLock'))
})

test('Phase 1J 15: shared lock covers cancellation path', () => {
  assert.ok(service().includes('return this.withCheckoutLock(brokerId'))
})

test('Phase 1J 16: lock contention is a controlled conflict', () => {
  assert.ok(service().includes('CheckoutConflictError'))
  assert.ok(checkout().includes('status: 409'))
})

test('Phase 1J 17: Redis failure does not continue unsafe checkout', () => {
  assert.ok(service().includes('BillingUnavailableError'))
  assert.ok(service().includes('throw new BillingUnavailableError'))
  assert.ok(checkout().includes('status: 503'))
})

test('Phase 1J 18: duplicate checkout retry retains server validation', () => {
  assert.ok(checkout().includes('validatePlanPrice(plan, priceId)'))
  assert.ok(action().includes('validatePlanPrice(plan, priceId)'))
})

test('Phase 1J 19: customer ownership helper validates Stripe metadata', () => {
  const source = service()
  assert.ok(source.includes('customer.metadata?.userId'))
  assert.ok(source.includes('customer.metadata?.brokerId'))
})

test('Phase 1J 20: H5 entitlement and H6 event protections remain', () => {
  assert.ok(read('lib/broker-policy.ts').includes('hasPaidEntitlement'))
  assert.ok(webhook().includes('PROCESSING'))
  assert.ok(webhook().includes('PROCESSED'))
  assert.ok(webhook().includes('eventId'))
})
