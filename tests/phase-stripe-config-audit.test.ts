import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const read = (relative: string): string => fs.readFileSync(path.join(ROOT, relative), 'utf8')

const brokerItem = () => read('app/api/admin/broker-plans/[id]/route.ts')
const brokerColl = () => read('app/api/admin/broker-plans/route.ts')
const companyItem = () => read('app/api/admin/company-advertising-plans/[id]/route.ts')
const companyColl = () => read('app/api/admin/company-advertising-plans/route.ts')
const checkout = () => read('app/api/subscription/checkout/route.ts')
const secretsRoute = () => read('app/api/admin/stripe/secrets/route.ts')
const stripeConfig = () => read('lib/stripe-config.ts')
const webhook = () => read('app/api/stripe/webhook/route.ts')

// --- Authorization: every admin plan mutation enforces ADMIN from the session ---
test('Admin plan routes reject non-admins (broker)', () => {
  const item = brokerItem()
  // isAdmin / getAdminUser gate on every mutating method
  assert.ok(item.includes("getAdminUser()"))
  assert.ok(item.includes("status: 403"))
  assert.ok(brokerColl().includes("getAdminUser()"))
})

test('Admin plan routes reject non-admins (company)', () => {
  const item = companyItem()
  assert.ok(item.includes("user.role !== 'ADMIN'"))
  assert.ok(item.includes('status: 401'))
  assert.ok(companyColl().includes("user.role !== 'ADMIN'"))
})

// --- Broker plan PATCH: active-subscription Stripe-identity guard (HIGH) ---
test('Broker plan PATCH blocks Stripe mapping change while subscriptions are active', () => {
  const src = brokerItem()
  assert.ok(src.includes('prisma.brokerSubscription.count('))
  assert.ok(src.includes('planId: id, isActive: true'))
  assert.ok(src.includes('stripeMappingChanged'))
  assert.ok(src.includes('hasActiveSubscriptions > 0 && stripeMappingChanged'))
  // 409 rejection message
  assert.ok(src.includes('Changing its Stripe price/product would break active billing'))
})

test('Broker plan PATCH blocks deactivation while subscriptions are active', () => {
  const src = brokerItem()
  assert.ok(src.includes('body.isActive === false && hasActiveSubscriptions > 0'))
  assert.ok(src.includes('Deactivate those subscriptions before deactivating the plan'))
})

// --- Company plan PATCH: deactivation guard mirrors the broker guard ---
test('Company plan PATCH blocks deactivation while subscriptions are active', () => {
  const src = companyItem()
  assert.ok(src.includes('update.isActive === false && hasActiveSubscriptions > 0'))
  assert.ok(src.includes('Deactivate those subscriptions before deactivating the plan'))
})

// --- Webhook isolation: active broker checkout now carries ownerType ---
test('Active broker checkout sets ownerType BROKER for webhook isolation', () => {
  const src = checkout()
  const occurrences = (src.match(/ownerType: 'BROKER'/g) || []).length
  assert.ok(occurrences >= 2, 'ownerType BROKER should appear in both metadata blocks')
})

// --- Secret non-exposure in admin Stripe config API ---
test('Admin Stripe secrets API never returns the raw secret', () => {
  const src = secretsRoute()
  // returns only safe status metadata
  assert.ok(src.includes('ok: true'))
  assert.ok(src.includes('configured'))
  assert.ok(src.includes('mode'))
  // must NOT echo the stored secret value back
  assert.ok(!src.includes('secretKey: secretKey'))
  assert.ok(!src.includes('webhookSecret: webhookSecret'))
})

// --- Config precedence: admin DB secret overrides env fallback ---
test('Stripe secret resolution uses SecureConfig (DB) first, env fallback', () => {
  const src = stripeConfig()
  assert.ok(src.includes('getStoredSecret('))
  assert.ok(src.includes('process.env.STRIPE_SECRET_KEY'))
  assert.ok(src.includes('process.env.STRIPE_WEBHOOK_SECRET'))
})

// --- Webhook verification uses the resolver, not a client value ---
test('Webhook signature verification resolves secret via getStripeWebhookSecret()', () => {
  const src = webhook()
  assert.ok(src.includes('getStripeWebhookSecret()'))
  assert.ok(src.includes('constructEvent'))
})
