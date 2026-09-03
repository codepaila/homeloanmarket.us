import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const read = (relative: string): string => fs.readFileSync(path.join(ROOT, relative), 'utf8')

// ---------------------------------------------------------------------------
// PHASE 2/4.2 — Webhook owner-type isolation + broker/company isolation
// ---------------------------------------------------------------------------
// Audit F6: a Stripe customer (and therefore the associated subscription event)
// can belong to the Broker product or the Company product. Without strict
// routing, a COMPANY event could mutate a BrokerSubscription and vice versa.
// The fix routes by `metadata.ownerType` and, for legacy ownerType-less events,
// resolves the owning product strictly (never silently choosing the first match).
// ---------------------------------------------------------------------------

const webhook = read('app/api/stripe/webhook/route.ts')
const service = read('lib/subscription.ts')

test('webhook forwards ownerType metadata for every subscription event type', () => {
  // Every handler that calls updateSubscriptionFromStripe passes the ownerType.
  assert.match(webhook, /subscription\.metadata\?\.ownerType \|\| session\.metadata\?\.ownerType \|\| null/)
  assert.match(webhook, /subscription\.metadata\?\.ownerType \|\| null/)
})

test('checkout.session.expired is COMPANY-only (never reconciles broker rows)', () => {
  assert.match(webhook, /ownerType !== 'COMPANY' \|\| !session\.customer\) return/)
  assert.match(webhook, /reconcileCompanyCheckoutExpired\(/)
})

test('explicit COMPANY events route to the company subscription only', () => {
  assert.match(service, /if \(ownerType === 'COMPANY'\)/)
  assert.match(service, /updateCompanySubscriptionFromStripe\(/)
  assert.match(service, /if \(!companySubscription\) throw new Error\('Company subscription not found'\)/)
})

test('explicit BROKER_REGISTRATION events route to the registration subscription only', () => {
  assert.match(service, /if \(ownerType === 'BROKER_REGISTRATION'\)/)
  assert.match(service, /updateRegistrationSubscriptionFromStripe\(/)
})

test('explicit BROKER never falls through to another product when no broker row exists', () => {
  assert.match(service, /if \(ownerType === 'BROKER'\) throw new Error\('Broker subscription not found'\)/)
})

test('legacy ownerType-less events resolve the owning product strictly (no silent first-match)', () => {
  // When the broker-first lookup misses, all three products are enumerated and
  // an ambiguous match across products is refused.
  assert.match(service, /prisma\.brokerSubscription\.findFirst\(\{\s*\n\s*where: \{ stripeCustomerId \}/)
  assert.match(service, /prisma\.brokerRegistrationSubscription\.findFirst\(/)
  assert.match(service, /prisma\.companySubscription\.findFirst\(/)
  assert.match(service, /matches > 1/)
  assert.match(service, /Ambiguous Stripe customer ownership/)
})

test('company reconcile refuses an event whose ownerType is not COMPANY', () => {
  assert.match(service, /ownerType !== 'COMPANY'\) throw new Error\('Stripe event ownerType does not belong to the company product'\)/)
})

test('company checkout creates the Stripe customer with ownerType COMPANY metadata', () => {
  const checkout = read('app/api/company/subscription/checkout/route.ts')
  assert.match(checkout, /ownerType: 'COMPANY'/)
  assert.match(checkout, /metadata: \{ userId: current\.user\.id, companyId: current\.company\.id, ownerType: 'COMPANY' \}/)
})
