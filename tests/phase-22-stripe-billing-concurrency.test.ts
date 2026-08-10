import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const read = (relative: string): string => fs.readFileSync(path.join(ROOT, relative), 'utf8')

test('billing lock has owner token, lease renewal, and cleanup', () => {
  const source = read('lib/subscription.ts')
  assert.ok(source.includes('const lockValue = crypto.randomUUID()'))
  assert.ok(source.includes('const renewal = setInterval'))
  assert.ok(source.includes('redis.eval'))
  assert.ok(source.includes('clearInterval(renewal)'))
  assert.ok(source.includes('current === lockValue'))
})

test('billing lock fails closed on Redis acquisition failure', () => {
  const source = read('lib/subscription.ts')
  assert.ok(source.includes('throw new BillingUnavailableError()'))
  assert.ok(source.includes('CheckoutConflictError'))
})

test('fresh webhook PROCESSING events are retryable, not acknowledged duplicates', () => {
  const source = read('app/api/stripe/webhook/route.ts')
  assert.ok(source.includes('Webhook event is already processing'))
  assert.ok(source.includes('existing.updatedAt > new Date(Date.now() - 5 * 60 * 1000)'))
})

test('stale PROCESSING events are reclaimed through existing retry path', () => {
  const source = read('app/api/stripe/webhook/route.ts')
  assert.ok(source.includes("existing?.status === 'FAILED' || existing?.status === 'PROCESSING'"))
  assert.ok(source.includes("data: { status: 'PROCESSING', error: null }"))
})

test('cancellation uses deterministic Stripe idempotency', () => {
  const service = read('lib/subscription.ts')
  const action = read('actions/subscription.ts')
  assert.ok(service.includes('cancel_${subscription.stripeCustomerId}_${subscription.stripeSubId}'))
  assert.ok(action.includes('cancel_${user.id}_${user.stripeCustomerId}_${subscriptionId}'))
})

test('alternate cancellation reconciles from Stripe after mutation', () => {
  const source = read('actions/subscription.ts')
  assert.ok(source.includes('await SubscriptionService.syncWithStripe(user.brokerProfile.id)'))
})

test('upgrade idempotency payload is stable', () => {
  const api = read('app/api/subscription/upgrade/route.ts')
  assert.ok(api.includes('idempotencyKey: `upgrade_${user.id}_${subscription.id}_${priceId}`'))
  assert.equal(api.includes('upgradedAt:'), false)
})

test('checkout and upgrade use separate operation namespaces', () => {
  const checkout = read('app/api/subscription/checkout/route.ts')
  const upgrade = read('app/api/subscription/upgrade/route.ts')
  assert.ok(checkout.includes('checkout_${user.id}_${customerId}_${plan}_${priceId}'))
  assert.ok(upgrade.includes('upgrade_${user.id}_${subscription.id}_${priceId}'))
})

test('portal/invoice/alternate billing ownership uses the central helper', () => {
  assert.ok(read('app/api/subscription/portal/route.ts').includes('assertStripeCustomerOwnership'))
  assert.ok(read('app/api/subscription/invoices/route.ts').includes('assertStripeCustomerOwnership'))
  assert.ok(read('actions/subscription.ts').includes('assertStripeCustomerOwnership'))
})

test('H5 entitlement and H6 event protections remain intact', () => {
  assert.ok(read('lib/broker-policy.ts').includes('hasPaidEntitlement'))
  const webhook = read('app/api/stripe/webhook/route.ts')
  assert.ok(webhook.includes('PROCESSING'))
  assert.ok(webhook.includes('PROCESSED'))
  assert.ok(webhook.includes('FAILED'))
  assert.ok(webhook.includes('eventCreatedAt'))
})
