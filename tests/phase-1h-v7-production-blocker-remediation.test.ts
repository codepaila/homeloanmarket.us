import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const read = (relative: string): string => fs.readFileSync(path.join(ROOT, relative), 'utf8')

test('Phase 1H claim credentials use the shared authorization boundary', () => {
  const auth = read('lib/auth.config.ts')
  const claimPage = read('app/claim-broker/[token]/page.tsx')
  const continuePage = read('app/claim-broker/continue/page.tsx')
  assert.ok(auth.includes('brokerLoginRateLimit.limit(`login:${ip}`)'))
  assert.ok(claimPage.includes("signIn('credentials'"))
  assert.ok(continuePage.includes("signIn('credentials'"))
  assert.ok(auth.includes('async authorize(credentials)'))
})

test('Phase 1H Stripe customer creation is authenticated, persisted, and idempotent', () => {
  const action = read('actions/subscription.ts')
  const route = read('app/api/subscription/checkout/route.ts')
  assert.ok(action.includes('const user = await getCurrentUser()'))
  assert.ok(action.includes("if (!user?.email) throw new Error('Unauthorized')"))
  assert.ok(action.includes('stripe_customer_${user.id}'))
  assert.ok(action.includes('brokerSubscription.upsert'))
  assert.ok(route.includes('idempotencyKey: `stripe_customer_${user.id}`'))
})

test('Phase 1H checkout intents use deterministic server-derived keys', () => {
  const action = read('actions/subscription.ts')
  const route = read('app/api/subscription/checkout/route.ts')
  assert.ok(action.includes('idempotencyKey: `checkout_${user.id}_${customerId}_${plan}_${priceId}`'))
  assert.ok(route.includes('const idempotencyKey = `checkout_${user.id}_${customerId}_${plan}_${priceId}`'))
  assert.equal(action.includes('Math.floor(Date.now()'), false)
  assert.equal(route.includes('idempotencyBucket'), false)
})

test('Phase 1H admin broker page passes only the explicit action DTO', () => {
  const page = read('app/admin/brokers/[id]/page.tsx')
  assert.ok(page.includes('select:'))
  assert.ok(page.includes('const brokerDto ='))
  assert.ok(page.includes('<AdminBrokerActions broker={brokerDto} />'))
  assert.equal(page.includes('subscription: true'), false)
  assert.equal(page.includes('<AdminBrokerActions broker={broker} />'), false)
})
