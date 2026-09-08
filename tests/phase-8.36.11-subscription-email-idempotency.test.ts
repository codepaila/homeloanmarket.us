import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { isClaimEligible } from '@/lib/broker-subscription-email-state'

const read = (p: string) => fs.readFileSync(p, 'utf8')
const durable = read('lib/broker-subscription-email.ts')
const stateModule = read('lib/broker-subscription-email-state.ts')
const templates = read('lib/email-templates.ts')
const actions = read('actions/email.action.ts')
const webhook = read('app/api/stripe/webhook/route.ts')
const schema = read('prisma/schema.prisma')

// ===========================================================================
// PHASE 8.36.11 — HARDEN BROKER SUBSCRIPTION PURCHASE EMAIL IDEMPOTENCY
// Durable, concurrency-safe, retryable delivery for the broker purchase email.
// ===========================================================================

test('1. idempotency key is deterministic and broker-subscription-scoped', () => {
  assert.match(durable, /idempotencyKey = `subscription_purchase_\$\{brokerSubscriptionId\}`/)
  assert.doesNotMatch(durable, /subscription_purchase_\$\{[^}]*Date\.now/)
})

test('2. durable state is persisted in MongoDB with a unique idempotency key', () => {
  assert.match(schema, /model BrokerSubscriptionEmailLog /)
  assert.match(schema, /idempotencyKey\s+String\s+@unique/)
  assert.match(schema, /brokerSubscriptionId\s+String\s+@unique @db\.ObjectId/)
  assert.match(schema, /status\s+BrokerSubscriptionEmailStatus/)
  assert.match(schema, /enum BrokerSubscriptionEmailStatus/)
  for (const s of ['PENDING', 'PROCESSING', 'SENT', 'FAILED']) {
    assert.match(schema, new RegExp(`\\b${s}\\b`))
  }
})

test('3. email is marked SENT only AFTER a successful provider send (never before)', () => {
  // The post-send SENT write is uniquely identified by the messageId assignment.
  const sentMarkIndex = durable.indexOf('messageId: result.messageId || null')
  const sendIndex = durable.indexOf('result = await sendEmail(')
  assert.ok(sendIndex !== -1, 'provider send exists')
  assert.ok(sentMarkIndex !== -1, 'post-send SENT write exists')
  assert.ok(sentMarkIndex > sendIndex, 'SENT recorded after the provider send')
  // No "record SENT then send" ordering exists.
  assert.doesNotMatch(durable, /status: 'SENT'[\s\S]{0,120}sendEmail\(/)
})

test('4. claim is concurrency-safe: only one process wins via atomic updateMany', () => {
  assert.match(durable, /updateMany\(/)
  assert.match(durable, /claimed\.count !== 1/)
  assert.match(durable, /claimEligibleWhere\(idempotencyKey, now\)/)
  assert.match(stateModule, /status: { in: \['PENDING', 'FAILED'\] }/)
  assert.match(stateModule, /status: 'PROCESSING', leaseExpiresAt: { lte: now }/)
})

test('5. failed sends remain retryable (FAILED state, never SENT)', () => {
  assert.match(durable, /status: 'FAILED', lastError: result\.error/)
  assert.match(durable, /status: 'FAILED', lastError: sendError/)
  assert.match(durable, /retryable: true/)
})

test('6. a SENT row is never resent (durable dedup)', () => {
  assert.match(durable, /if \(current\?\.status === 'SENT'\) return \{ status: 'skipped', reason: 'already_sent' \}/)
})

test('7. stale PROCESSING claims recover via lease expiry', () => {
  const result = isClaimEligible('PROCESSING', new Date(Date.now() - 1000), new Date())
  assert.equal(result, true)
  const notYet = isClaimEligible('PROCESSING', new Date(Date.now() + 60_000), new Date())
  assert.equal(notYet, false)
})

test('8. claim eligibility predicate covers all states', () => {
  const now = new Date()
  assert.equal(isClaimEligible('PENDING', null, now), true)
  assert.equal(isClaimEligible('FAILED', null, now), true)
  assert.equal(isClaimEligible('SENT', null, now), false)
  assert.equal(isClaimEligible('PROCESSING', new Date(Date.now() - 1), now), true)
  assert.equal(isClaimEligible('PROCESSING', new Date(Date.now() + 1), now), false)
  assert.equal(isClaimEligible(undefined, null, now), false)
})

test('9. recipient is the authoritative broker email', () => {
  assert.match(durable, /subscription\.broker\.email \|\| subscription\.broker\.user\?\.email/)
})

test('10. only the canonical webhook trigger exists; no success-page/verify duplicate', () => {
  assert.equal((webhook.match(/sendSubscriptionPurchaseEmail\(/g) || []).length, 1)
  assert.doesNotMatch(read('app/api/subscription/verify/route.ts'), /sendSubscriptionPurchaseEmail/)
  assert.doesNotMatch(read('app/broker/subscription/success/page.tsx'), /sendSubscriptionPurchaseEmail|sendEmail/)
})

test('11. broker registration checkout does not trigger this purchase email', () => {
  // The webhook only fires when the synced row carries a brokerId (BrokerSubscription),
  // not a BrokerRegistrationSubscription.
  assert.match(webhook, /'brokerId' in updated/)
  assert.doesNotMatch(read('lib/broker-registration.ts'), /sendSubscriptionPurchaseEmail/)
})

test('12. abandoned/failed payments cannot reach the sender', () => {
  // Email is triggered only inside checkout.session.completed after an active sync.
  assert.match(webhook, /case 'checkout\.session\.completed'/)
  assert.match(webhook, /updated\.isActive/)
  assert.doesNotMatch(webhook, /checkout\.session\.expired[\s\S]{0,200}sendSubscriptionPurchaseEmail/)
})

test('13. no Company coupling / no coupon logic in the durable sender', () => {
  assert.doesNotMatch(durable, /Company|company/i)
  assert.doesNotMatch(durable, /coupon|promotion/i)
})

test('14. existing sendEmail boundary and template are preserved', () => {
  assert.match(durable, /sendEmail\(/)
  assert.match(durable, /emailTemplates\.subscriptionPurchased/)
  assert.match(templates, /subscriptionPurchased: /)
  assert.match(templates, /renderEmailShell\(/)
  assert.match(actions, /sendSubscriptionPurchaseEmail/)
  // The canonical entry point still delegates to the durable sender.
  assert.match(actions, /sendBrokerSubscriptionPurchaseEmailDurable/)
})