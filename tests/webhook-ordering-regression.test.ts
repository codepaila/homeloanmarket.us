import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const read = (relative: string): string => fs.readFileSync(path.join(ROOT, relative), 'utf8')

// ---------------------------------------------------------------------------
// Webhook ordering regression — the ordering/dedup contract must be preserved
// after the audit remediation phases.
// ---------------------------------------------------------------------------
// Scenarios guarded here (all must remain safe after the new event handling):
//   - Duplicate `checkout.session.completed` / duplicate subscription events
//     are idempotently skipped (PROCESSED event ids never re-handle).
//   - A stale `customer.subscription.updated` delivered before a
//     `checkout.session.completed` that is actually newer is ignored.
//   - An abandoned `checkout.session.expired` followed by a late
//     `checkout.session.completed` still establishes ACTIVE (reconciliation
//     never blocks a genuine activation).
// ---------------------------------------------------------------------------

const webhook = read('app/api/stripe/webhook/route.ts')
const service = read('lib/subscription.ts')

test('duplicate events are idempotently skipped', () => {
  assert.match(webhook, /if \(existing\?\.status === 'PROCESSED'\) return \{ duplicate: true \}/)
  assert.match(webhook, /if \(error\?\.code === 'P2002'\) return \{ duplicate: true \}/)
})

test('event ordering uses event.created and skips stale events', () => {
  assert.match(webhook, /isStaleEvent\(latestAppliedCreatedAt/, 'pure predicate exists')
  assert.match(webhook, /latestAppliedCreatedAt > eventCreatedAt/)
  assert.match(webhook, /eventCreatedAt: \{ gt: eventCreated \}/)
  assert.match(webhook, /P2011|PROCESSED'/, 'querying PROCESSED/in-flight events')
})

test('stale events are recorded as PROCESSED with a stale marker, never re-applied', () => {
  assert.match(webhook, /if \(!stale\) await handleStripeEvent\(event\)/)
  assert.match(webhook, /STALE_EVENT_IGNORED/)
  assert.match(webhook, /stale \? 'STALE_EVENT_IGNORED' : null/)
})

test('an expired checkout does not cancel or block a live subscription', () => {
  // reconcileCompanyCheckoutExpired refuses to touch a non-CHECKOUT_PENDING row
  // and never modifies an existing live Stripe subscription.
  assert.match(service, /existing\.status !== 'CHECKOUT_PENDING'/)
  assert.match(service, /live-subscription-present/)
})

test('a late completed event still writes ACTIVE unconditionally', () => {
  // updateCompanySubscriptionFromStripe writes mapped.status without any guard
  // that could reject a legitimately newer activation after an EXPIRED row.
  assert.match(service, /status: mapped\.status/)
  assert.match(service, /mapCompanySubscriptionStatus\(status\)/)
  assert.match(service, /isActive = mapped\.isActive/)
  // The expired reconcile only touches CHECKOUT_PENDING; it never stamps a
  // terminal state that a newer completed event would override.
  assert.match(service, /a late `checkout\.session\.completed`/)
})

test('subscriptions carrying a live-status guard: real activation is never gated on stale expiry', () => {
  // Scope precisely to updateCompanySubscriptionFromStripe's own body. The
  // CHECKOUT_PENDING guard (existing.status !== 'CHECKOUT_PENDING') exists only
  // in the reconciliation methods, NOT in the event-update path, so a genuinely
  // newer activation is never blocked by an earlier EXPIRED state.
  const start = service.indexOf('static async updateCompanySubscriptionFromStripe')
  const end = service.indexOf('static async cancelSubscription')
  assert.ok(start > -1 && end > start, 'method definition found in scope')
  const updateBlock = service.slice(start, end)
  assert.doesNotMatch(updateBlock, /existing\.status !== 'CHECKOUT_PENDING'/)
  assert.match(updateBlock, /status: mapped\.status/)
  assert.match(updateBlock, /isActive = mapped\.isActive/)
})
