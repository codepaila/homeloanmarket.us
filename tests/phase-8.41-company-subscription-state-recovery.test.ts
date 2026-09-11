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

test('dashboard confirmation window ends on any webhook-resolved status, not only ACTIVE', () => {
  assert.match(dashboardClient, /status && status !== 'CHECKOUT_PENDING'/, 'confirmation clears when the row leaves CHECKOUT_PENDING')
  assert.match(dashboardClient, /\[company\.subscription\?\.status\]/, 'effect re-runs on status resolution')
  assert.doesNotMatch(dashboardClient, /if \(company\.subscription\?\.isActive\)/, 'no longer gated solely on isActive')
})

test('dashboard strips the temporary success query once the webhook resolves the state', () => {
  assert.match(dashboardClient, /Payment received/)
  assert.match(dashboardClient, /setConfirming\(false\)/)
  assert.match(dashboardClient, /router\.replace\('\/company\/dashboard'\)/)
})

test('cancel flow reflects CANCELED without the confirmation banner persisting', () => {
  const block = dashboardClient.slice(
    dashboardClient.indexOf('async function cancel'),
    dashboardClient.indexOf('async function submitRequest'),
  )
  assert.match(block, /toast\.success\('Subscription canceled\.'\)/)
  assert.match(block, /router\.refresh\(\)/)
  // The resolved-status effect above re-renders status=CANCELED and clears the
  // banner; the banner is rendered only under `confirming`.
  assert.match(dashboardClient, /\{confirming && \(/)
})