import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const read = (relative: string): string => fs.readFileSync(path.join(ROOT, relative), 'utf8')

const dashboardClient = read('app/company/dashboard/CompanyDashboardClient.tsx')
const dashboardPage = read('app/company/dashboard/page.tsx')
const checkout = read('app/api/company/subscription/checkout/route.ts')
const service = read('lib/subscription.ts')
const webhook = read('app/api/stripe/webhook/route.ts')
const access = read('lib/company-ad-access.ts')

// ---------------------------------------------------------------------------
// A / M — Checkout success handoff is state-driven, never query-driven
// ---------------------------------------------------------------------------

test('A: immediately after checkout only CHECKOUT_PENDING renders the confirmation UI', () => {
  assert.match(dashboardClient, /const isPending = subscriptionStatus === 'CHECKOUT_PENDING'/)
  assert.match(dashboardClient, /const confirming = isPending && !confirmationTimedOut/)
  assert.match(dashboardClient, /\{confirming && \(/)
  assert.match(dashboardClient, /Payment received/)
  // The success query parameter cannot initialize or force the pending state.
  assert.match(dashboardClient, /const checkoutParam = searchParams\.get\('subscription'\) === 'success'/)
  assert.doesNotMatch(dashboardClient, /useState<boolean>\(fromCheckout \|\| isPending\)/)
})

test('A: Request Advertisement is disabled while pending', () => {
  const pendingRule = access.match(/status === 'ACTIVE' && subscription\?\.isActive === true/)
  assert.ok(pendingRule, 'shared access rule requires ACTIVE + isActive')
  assert.match(dashboardClient, /const canRequestAdvertisement = isActive/)
  assert.match(dashboardClient, /Subscription confirmation in progress/)
})

test('M: the temporary success query is consumed and stripped after one read', () => {
  assert.match(dashboardClient, /if \(!checkoutParam\) return/)
  assert.match(dashboardClient, /setArrivedFromCheckout\(true\)/)
  assert.match(dashboardClient, /router\.replace\('\/company\/dashboard'\)/)
})

// ---------------------------------------------------------------------------
// B / C / D — ACTIVE dashboard
// ---------------------------------------------------------------------------

test('B/C: an authoritative ACTIVE row immediately wins over the pending UI', () => {
  // The poll loop is keyed on the authoritative pending state and stops as soon
  // as the row is no longer CHECKOUT_PENDING (no reliance on a timer to end it).
  assert.match(dashboardClient, /if \(!isPending\) return/)
  assert.match(dashboardClient, /\}, \[isPending, router\]\)/)
  // No confirmation copy is reachable for ACTIVE.
  assert.match(dashboardClient, /\{confirmationTimedOut && isPending && \(/)
})

test('D: ACTIVE shows the active status, success acknowledgement, and enabled CTA', () => {
  assert.match(dashboardClient, /\? 'Active'/)
  assert.match(dashboardClient, /arrivedFromCheckout && isActive/)
  assert.match(dashboardClient, /Payment successful/)
  assert.match(dashboardClient, /Your advertising subscription is active\. You can now request an advertisement\./)
})

// ---------------------------------------------------------------------------
// E / F / G — PAST_DUE / CANCELED / EXPIRED are never ACTIVE
// ---------------------------------------------------------------------------

test('E/F/G: non-active states never grant advertising access', async () => {
  const { hasActiveCompanyAdvertisingSubscription } = await import('../lib/company-ad-access')
  for (const status of ['CHECKOUT_PENDING', 'PAST_DUE', 'CANCELED', 'EXPIRED', 'UNPAID', 'PAUSED', 'INCOMPLETE']) {
    assert.equal(hasActiveCompanyAdvertisingSubscription({ status, isActive: false }), false, `${status} must not grant access`)
  }
  assert.equal(hasActiveCompanyAdvertisingSubscription({ status: 'ACTIVE', isActive: true }), true)
})

test('E/F/G: dashboard maps every terminal state to a distinct label', () => {
  assert.match(dashboardClient, /'Confirming your subscription…'/)
  assert.match(dashboardClient, /'Past due'/)
  assert.match(dashboardClient, /'Canceled'/)
  assert.match(dashboardClient, /'Expired'/)
})

// ---------------------------------------------------------------------------
// H — Long confirmation recovery is bounded and superseded by ACTIVE
// ---------------------------------------------------------------------------

test('H: the recovery message appears only after the window and only while pending', () => {
  assert.match(dashboardClient, /CONFIRMATION_TIMEOUT_MS/)
  assert.match(dashboardClient, /CONFIRMATION_POLL_MS/)
  assert.match(dashboardClient, /CONFIRMATION_SLOW_POLL_MS/)
  assert.match(dashboardClient, /Confirmation is taking longer than expected/)
  assert.match(dashboardClient, /\{confirmationTimedOut && isPending && \(/)
})

// ---------------------------------------------------------------------------
// Reconciliation — a live Stripe subscription resolves the pending row
// ---------------------------------------------------------------------------

test('server dashboard re-reads the subscription after reconcile', () => {
  assert.match(dashboardPage, /reconcileStaleCompanyCheckout/)
  assert.match(dashboardPage, /let subscriptionRecord = current\.company\.subscription/)
  assert.match(dashboardPage, /subscriptionRecord = await prisma\.companySubscription\.findUnique/)
})

test('stale-checkout reconcile syncs an already-live Stripe subscription', () => {
  const block = service.slice(
    service.indexOf('static async reconcileStaleCompanyCheckout'),
    service.indexOf('// Controlled CompanyAdvertisingPlan deactivation'),
  )
  assert.match(block, /live-subscription-present/)
  assert.match(block, /await this\.updateCompanySubscriptionFromStripe\(/, 'live Stripe state is pushed into the local row')
  assert.match(block, /existing\.stripeSubId && liveSubscriptions\.find/, 'prefers the locally-referenced subscription')
  assert.doesNotMatch(block, /subscriptions\.cancel/, 'never cancels a remote subscription')
})

test('checkout route never creates a second session once reconcile resolves ACTIVE', () => {
  assert.match(checkout, /let existing = await prisma\.companySubscription\.findUnique/)
  assert.match(checkout, /existing = await prisma\.companySubscription\.findUnique/)
  // The active guard is applied again after reconciliation.
  const guardCount = (checkout.match(/existing\?\.isActive && existing\.stripeSubId/g) || []).length
  assert.ok(guardCount >= 2, 'active guard is re-checked after reconciliation')
})

// ---------------------------------------------------------------------------
// I/J/K — activation email + idempotency
// ---------------------------------------------------------------------------

test('company activation email is dispatched by the authoritative activation, not the success URL', () => {
  assert.match(webhook, /dispatchCompanyActivationEmail/)
  assert.match(webhook, /case 'customer\.subscription\.updated'/)
  assert.match(webhook, /case 'invoice\.payment_failed':/)
  assert.match(service, /async updateCompanySubscriptionFromStripe/)
  // The webhook never activates from the success query parameter.
  assert.doesNotMatch(webhook, /subscription=success/)
})

test('durable per-Stripe-subscription idempotency remains the email guard', () => {
  const sender = read('lib/company-subscription-email.ts')
  assert.match(sender, /company_subscription_activation_\$\{companySubscriptionId\}/)
  assert.match(sender, /status === 'SENT'/)
  assert.match(sender, /claimEligibleWhere/)
})

test('stale Stripe subscriptions cannot overwrite the current company subscription', () => {
  const block = service.slice(
    service.indexOf('static async updateCompanySubscriptionFromStripe'),
    service.indexOf('static async cancelSubscription'),
  )
  assert.match(block, /existing\.stripeSubId !== stripeSubscriptionId/)
  assert.match(block, /currentIsTerminal/)
  assert.doesNotMatch(block, /brokerSubscription|brokerRegistration/)
})

// ---------------------------------------------------------------------------
// Server-side advertisement-request authorization remains authoritative
// ---------------------------------------------------------------------------

test('the advertisement-request API enforces the shared ACTIVE gate', () => {
  const route = read('app/api/company/requests/route.ts')
  const gateIndex = route.indexOf('hasActiveCompanyAdvertisingSubscription')
  const createIndex = route.indexOf('companyAdRequest.create')
  assert.ok(gateIndex > -1 && createIndex > gateIndex, 'server gate runs before creation')
  assert.match(route, /SUBSCRIPTION_REQUIRED_ERROR_CODE/)
})
