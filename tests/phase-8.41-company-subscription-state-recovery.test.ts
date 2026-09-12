import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const read = (relative: string): string => fs.readFileSync(path.join(ROOT, relative), 'utf8')

const service = read('lib/subscription.ts')
const dashboardClient = read('app/company/dashboard/CompanyDashboardClient.tsx')

const staleCheckoutBlock = () =>
  service.slice(
    service.indexOf('static async reconcileStaleCompanyCheckout'),
    service.indexOf('deactivateCompanyAdvertisingPlan'),
  )

const expiredCheckoutBlock = () =>
  service.slice(
    service.indexOf('static async reconcileCompanyCheckoutExpired'),
    service.indexOf('static async reconcileBrokerRegistrationCheckoutExpired'),
  )

// ---------------------------------------------------------------------------
// EXPIRED + "Payment received" contradiction: a successful checkout must never
// be reconciled to EXPIRED while the webhook is still recording the payment.
// ---------------------------------------------------------------------------

test('reconcileStaleCompanyCheckout probes Stripe for a live subscription unconditionally', () => {
  const block = staleCheckoutBlock()
  assert.match(block, /subscriptions\.list/)
  assert.match(block, /live-subscription-present/)
  // The live probe must NOT be gated on the local stripeSubId: after a
  // successful payment the webhook may not have recorded the sub ID yet, and a
  // null local ID must not cause a premature EXPIRED.
  assert.doesNotMatch(block, /\bif\s*\(\s*existing\.stripeSubId\s*\)/)
})

test('reconcileStaleCompanyCheckout falls back to the stored customer id', () => {
  assert.match(staleCheckoutBlock(), /customerId \?\? existing\.stripeCustomerId/)
})

test('reconcileStaleCompanyCheckout never expires an open re-checkout session', () => {
  const block = staleCheckoutBlock()
  assert.match(block, /checkout\.sessions\.list/)
  assert.match(block, /open-checkout-present/)
  assert.match(block, /session\.status === 'open'/)
  assert.match(block, /session\.metadata\?\.companyId === companyId/)
})

test('reconcileCompanyCheckoutExpired probes live subscriptions unconditionally too', () => {
  const block = expiredCheckoutBlock()
  assert.match(block, /subscriptions\.list/)
  assert.match(block, /live-subscription-present/)
  assert.doesNotMatch(block, /\bif\s*\(\s*existing\.stripeSubId\s*\)/)
  // Safety contract preserved: never cancels a remote subscription and only a
  // pending row is touched.
  assert.doesNotMatch(block, /subscriptions\.cancel/)
  assert.match(block, /existing\.status !== 'CHECKOUT_PENDING'/)
  assert.match(block, /Rule 7|unrelated abandoned session/)
})

test('reconcileCompanyCheckoutExpired never expires an open retry session', () => {
  const block = expiredCheckoutBlock()
  assert.match(block, /checkout\.sessions\.list/)
  assert.match(block, /open-checkout-present/)
  assert.match(block, /session\.status === 'open'/)
})

test('genuinely stale rows (no Stripe customer) still reconcile to EXPIRED', () => {
  const block = staleCheckoutBlock()
  assert.match(block, /!effectiveCustomerId/)
  assert.match(block, /status: 'EXPIRED'/)
})

// ---------------------------------------------------------------------------
// Cancel / resolved states must clear the "Payment received" banner.
// ---------------------------------------------------------------------------

test('dashboard confirmation UI is derived only from the authoritative CHECKOUT_PENDING status', () => {
  assert.match(dashboardClient, /const isPending = subscriptionStatus === 'CHECKOUT_PENDING'/, 'pending derives from the server subscription row')
  assert.match(dashboardClient, /const confirming = isPending && !confirmationTimedOut/, 'confirmation is gated on the authoritative pending state')
  // The success query parameter must never be able to force the pending UI.
  assert.match(dashboardClient, /const checkoutParam = searchParams\.get\('subscription'\) === 'success'/)
  assert.doesNotMatch(dashboardClient, /useState<boolean>\(fromCheckout \|\| isPending\)/, 'the query param can no longer initialize the confirmation state')
  assert.doesNotMatch(dashboardClient, /if \(company\.subscription\?\.isActive\)/, 'no longer gated solely on isActive')
})

test('dashboard strips the temporary success query once consumed', () => {
  assert.match(dashboardClient, /Payment received/)
  assert.match(dashboardClient, /setArrivedFromCheckout\(true\)/)
  assert.match(dashboardClient, /setConfirmationTimedOut\(true\)/)
  assert.match(dashboardClient, /router\.replace\('\/company\/dashboard'\)/)
})

test('ACTIVE immediately wins over the timeout/long-confirmation message', () => {
  // The poll loop stops the instant the row is no longer CHECKOUT_PENDING, so
  // confirmed ACTIVE state always supersedes the recovery message.
  assert.match(dashboardClient, /if \(!isPending\) return/)
  assert.match(dashboardClient, /\[isPending, router\]/)
  assert.match(dashboardClient, /\{confirmationTimedOut && isPending && \(/)
  assert.match(dashboardClient, /arrivedFromCheckout && isActive/, 'one-time success acknowledgement only in the active state')
})

test('cancel flow reflects CANCELED without the confirmation banner persisting', () => {
  const block = dashboardClient.slice(
    dashboardClient.indexOf('async function cancel'),
    dashboardClient.indexOf('async function submitRequest'),
  )
  assert.match(block, /toast\.success\('Subscription canceled\.'\)/)
  assert.match(block, /router\.refresh\(\)/)
  // The resolved-status render clears the banner; the banner is rendered only
  // under `confirming`, which is false for CANCELED.
  assert.match(dashboardClient, /\{confirming && \(/)
})