import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const read = (relative: string): string => fs.readFileSync(path.join(ROOT, relative), 'utf8')

// ---------------------------------------------------------------------------
// PHASE 1 / 1B — Abandoned Company Checkout reconciliation
// ---------------------------------------------------------------------------

test('webhook allowlist includes checkout.session.expired (critical)', () => {
  const config = read('lib/stripe-config.ts')
  assert.match(config, /checkout\.session\.expired/)
  const line = config.split('\n').find((l) => l.includes('checkout.session.expired'))
  assert.ok(line && line.includes('critical: true'), 'expired must be critical so it is never disabled')
})

test('webhook handles checkout.session.expired for COMPANY (and BROKER_REGISTRATION) with product isolation', () => {
  const webhook = read('app/api/stripe/webhook/route.ts')
  assert.match(webhook, /case 'checkout\.session\.expired'/)
  assert.match(webhook, /reconcileCompanyCheckoutExpired/)
  // Company expired checkouts are routed to the company reconcile path via the
  // explicit ownerType guard, keeping COMPANY and broker-registration rows
  // strictly isolated.
  assert.match(webhook, /ownerType === 'COMPANY'/)
  assert.match(webhook, /reconcileBrokerRegistrationCheckoutExpired/)
  assert.match(webhook, /ownerType === 'BROKER_REGISTRATION'/)
})

test('reconcile method only touches CHECKOUT_PENDING and never cancels a live subscription', () => {
  const service = read('lib/subscription.ts')
  const start = service.indexOf('static async reconcileCompanyCheckoutExpired')
  const end = service.indexOf('static async reconcileStaleCompanyCheckout')
  assert.ok(start > -1 && end > start, 'method definition found in scope')
  const block = service.slice(start, end)
  assert.match(block, /existing\.status !== 'CHECKOUT_PENDING'/)
  assert.match(block, /status: 'EXPIRED'/)
  assert.match(block, /live-subscription-present/)
  // It never touches the Stripe subscription lifecycle (no remote cancel).
  assert.doesNotMatch(block, /subscriptions\.cancel/)
  // Rule 7 documented safety: an unrelated abandoned session must not affect a
  // live / non-pending row.
  assert.match(block, /Rule 7|unrelated abandoned session/)
  // A late completed event can still activate afterwards (documented contract).
  assert.match(service, /checkout\.session\.completed/)
})

test('stale reconcile is bounded to a single company and idempotent', () => {
  const service = read('lib/subscription.ts')
  assert.match(service, /reconcileStaleCompanyCheckout\(companyId: string, customerId: string \| null\)/)
  assert.match(service, /not-pending/)
  // Must not do a full-DB scan: no findMany over all companies in this path.
  const block = service.slice(service.indexOf('reconcileStaleCompanyCheckout'), service.indexOf('deactivateCompanyAdvertisingPlan'))
  assert.doesNotMatch(block, /findMany\(\{/)
})

test('checkout route performs bounded stale reconciliation before a fresh session', () => {
  const checkout = read('app/api/company/subscription/checkout/route.ts')
  assert.match(checkout, /reconcileStaleCompanyCheckout/)
  assert.match(checkout, /existing\?\.status === 'CHECKOUT_PENDING'/)
})

test('a late checkout.session.completed still establishes ACTIVE (never blocked by reconciliation)', () => {
  const service = read('lib/subscription.ts')
  // Scope to updateCompanySubscriptionFromStripe's own body. It writes the
  // mapped ACTIVE status unconditionally with no CHECKOUT_PENDING guard, so a
  // genuine activation arriving after an EXPIRED reconcile still establishes
  // access.
  const start = service.indexOf('static async updateCompanySubscriptionFromStripe')
  const end = service.indexOf('static async cancelSubscription')
  assert.ok(start > -1 && end > start, 'method definition found in scope')
  const update = service.slice(start, end)
  assert.match(update, /status: mapped\.status/)
  assert.doesNotMatch(update, /existing\.status !== 'CHECKOUT_PENDING'/)
})

test('a late activation writes isActive true and marks the company ACTIVE', () => {
  const service = read('lib/subscription.ts')
  const start = service.indexOf('static async updateCompanySubscriptionFromStripe')
  const end = service.indexOf('static async cancelSubscription')
  const update = service.slice(start, end)
  // The ACTIVE branch sets isActive true and flips the company status to ACTIVE.
  assert.match(update, /const isActive = mapped\.isActive/)
  assert.match(update, /if \(isActive\) await tx\.company\.update/)
  assert.match(update, /data: \{ status: 'ACTIVE' \}/)
})
