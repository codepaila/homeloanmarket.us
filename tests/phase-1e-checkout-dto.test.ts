import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const read = (relative: string): string => fs.readFileSync(path.join(ROOT, relative), 'utf8')

test('Phase 1E checkout: success page targets the implemented verification endpoint', () => {
  const page = read('app/broker/subscription/success/page.tsx')
  const route = read('app/api/subscription/verify/route.ts')
  assert.ok(page.includes('/api/subscription/verify?session_id='))
  assert.ok(route.includes('export async function GET'))
  assert.ok(route.includes('searchParams.get(\'session_id\')'))
})

test('Phase 1E checkout: verification requires authentication and validates ownership', () => {
  const route = read('app/api/subscription/verify/route.ts')
  assert.ok(route.includes('getCurrentUser()'))
  assert.ok(route.includes('status: 401'))
  assert.ok(route.includes('stripeCustomerId'))
  assert.ok(route.includes('customerId !== storedSubscription.stripeCustomerId'))
  assert.ok(route.includes('metadata.userId'))
  assert.ok(route.includes('metadata.brokerId'))
})

test('Phase 1E checkout: verification derives entitlement from Stripe price and canonical service', () => {
  const route = read('app/api/subscription/verify/route.ts')
  assert.ok(route.includes('stripe.checkout.sessions.retrieve'))
  assert.ok(route.includes('stripe.subscriptions.retrieve'))
  assert.ok(route.includes('stripeSubscription.items.data[0]?.price.id'))
  assert.ok(route.includes('SubscriptionService.updateSubscriptionFromStripe'))
  assert.equal(route.includes('request.json'), false)
  assert.equal(route.includes('plan ='), false)
  assert.equal(route.includes('const plan ='), false)
})

test('Phase 1E checkout: invalid and incomplete sessions are rejected', () => {
  const route = read('app/api/subscription/verify/route.ts')
  assert.ok(route.includes("!sessionId || !sessionId.startsWith('cs_')"))
  assert.ok(route.includes("session.status !== 'complete'"))
  assert.ok(route.includes("session.payment_status !== 'paid'"))
  assert.ok(route.includes("!['active', 'trialing'].includes(stripeSubscription.status)"))
  assert.ok(route.includes('status: 409'))
})

test('Phase 1E checkout: response is a safe subscription DTO', () => {
  const route = read('app/api/subscription/verify/route.ts')
  assert.ok(route.includes('planName: updated.plan'))
  assert.ok(route.includes('plan: updated.plan'))
  assert.ok(route.includes('isActive: updated.isActive'))
  assert.equal(route.includes('stripeCustomerId: updated'), false)
  assert.equal(route.includes('stripeSubId: updated'), false)
})

test('Phase 1E DTO: company and dashboard use the canonical owner DTO', () => {
  assert.ok(read('app/broker/company/page.tsx').includes('toBrokerOwnerDto'))
  assert.ok(read('app/broker/dashboard/page.tsx').includes('toBrokerOwnerDto'))
  const dto = read('lib/broker-owner-dto.ts')
  assert.ok(dto.includes('subscription: broker.subscription'))
  assert.ok(dto.includes('plan: broker.subscription.plan'))
  assert.ok(dto.includes('isActive: broker.subscription.isActive'))
  assert.equal(dto.includes('stripeCustomerId'), false)
  assert.equal(dto.includes('stripeSubId'), false)
  assert.equal(dto.includes('contactMessages'), false)
})

test('Phase 1E DTO: subscription responses omit internal Stripe identifiers', () => {
  const usage = read('app/api/subscription/usage/route.ts')
  const details = read('app/api/subscription/details/route.ts')
  assert.equal(usage.includes('stripeCustomerId: subscription'), false)
  assert.equal(usage.includes('stripeSubId: subscription'), false)
  assert.equal(details.includes('stripeCustomerId: user'), false)
  assert.equal(details.includes('subscriptionId: user'), false)
})
