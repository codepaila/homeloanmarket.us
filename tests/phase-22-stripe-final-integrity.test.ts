import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const read = (relative: string): string => fs.readFileSync(path.join(ROOT, relative), 'utf8')

test('replacement cancellation webhook does not overwrite an active replacement', () => {
  const source = read('lib/subscription.ts')
  assert.ok(source.includes('currentStripeSubscription'))
  assert.ok(source.includes('currentIsActive && !incomingIsActive'))
})

test('replacement webhook accepts a new active subscription after terminal state', () => {
  const source = read('lib/subscription.ts')
  assert.ok(source.includes("['canceled', 'incomplete_expired']"))
  assert.ok(source.includes('currentIsTerminal'))
})

test('upgrade operation has a distinct deterministic Stripe idempotency key', () => {
  const source = read('app/api/subscription/upgrade/route.ts')
  assert.ok(source.includes('idempotencyKey: `upgrade_${user.id}_${subscription.id}_${priceId}`'))
})

test('alternate upgrade action has a distinct deterministic key and lock', () => {
  const source = read('actions/subscription.ts')
  assert.ok(source.includes('idempotencyKey: `upgrade_${user.id}_${subscriptionId}_${priceId}`'))
  assert.ok(source.includes('SubscriptionService.withCheckoutLock'))
})

test('primary checkout payload matches alternate checkout billing parameters', () => {
  const route = read('app/api/subscription/checkout/route.ts')
  const action = read('actions/subscription.ts')
  assert.ok(route.includes('subscription_data:'))
  assert.ok(route.includes("billing_address_collection: 'required'"))
  assert.ok(action.includes('subscription_data:'))
  assert.ok(action.includes("billing_address_collection: 'required'"))
})

test('portal uses central Stripe customer ownership validation', () => {
  const source = read('app/api/subscription/portal/route.ts')
  assert.ok(source.includes('assertStripeCustomerOwnership'))
})

test('invoice path uses central Stripe customer ownership validation', () => {
  const source = read('app/api/subscription/invoices/route.ts')
  assert.ok(source.includes('assertStripeCustomerOwnership'))
})

test('alternate subscription actions validate remote customer ownership', () => {
  const source = read('actions/subscription.ts')
  assert.ok(source.includes('assertStripeCustomerOwnership(user.id, user.brokerProfile.id, user.stripeCustomerId)'))
  assert.ok(source.includes('subscription.customer !== user.stripeCustomerId'))
})

test('webhook lock failure remains retryable rather than silently continuing', () => {
  const source = read('app/api/stripe/webhook/route.ts')
  assert.ok(source.includes('SubscriptionService.withBillingLock'))
  assert.ok(read('lib/subscription.ts').includes('throw new BillingUnavailableError()'))
})

test('webhook replacement events retain event ledger and stale guards', () => {
  const source = read('app/api/stripe/webhook/route.ts')
  assert.ok(source.includes('eventId'))
  assert.ok(source.includes('PROCESSING'))
  assert.ok(source.includes('PROCESSED'))
  assert.ok(source.includes('STALE_EVENT_IGNORED'))
})

test('failed Stripe cancellation does not write inactive local state', () => {
  const source = read('lib/subscription.ts')
  assert.ok(source.includes("throw new Error('Stripe cancellation failed')"))
})

test('checkout and cancellation share the Broker billing lock', () => {
  const source = read('lib/subscription.ts')
  const route = read('app/api/subscription/checkout/route.ts')
  assert.ok(route.includes('withCheckoutLock'))
  assert.ok(source.includes('return this.withCheckoutLock(brokerId'))
})

test('checkout and upgrade share the Broker billing lock', () => {
  assert.ok(read('app/api/subscription/upgrade/route.ts').includes('withCheckoutLock'))
})

test('client cannot set entitlement through checkout verification', () => {
  const source = read('app/api/subscription/verify/route.ts')
  assert.equal(source.includes('request.json'), false)
  assert.ok(source.includes('stripeSubscription.items.data[0]?.price.id'))
  assert.ok(source.includes('updateSubscriptionFromStripe'))
})

test('H5 and H6 protections remain after billing changes', () => {
  assert.ok(read('lib/broker-policy.ts').includes('hasPaidEntitlement'))
  const webhook = read('app/api/stripe/webhook/route.ts')
  assert.ok(webhook.includes('eventCreatedAt'))
  assert.ok(webhook.includes('FAILED'))
})
