import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const read = (relative: string): string => fs.readFileSync(path.join(ROOT, relative), 'utf8')

const dashboardPage = read('app/company/dashboard/page.tsx')
const dashboardClient = read('app/company/dashboard/CompanyDashboardClient.tsx')
const checkout = read('app/api/company/subscription/checkout/route.ts')
const subscriptionService = read('lib/subscription.ts')
const webhook = read('app/api/stripe/webhook/route.ts')
const selectPage = read('app/company/subscription/select/page.tsx')

// ---------------------------------------------------------------------------
// Abandoned checkout self-healing on the dashboard
// ---------------------------------------------------------------------------

test('dashboard reconciles a stale CHECKOUT_PENDING so "Confirming..." is never permanent', () => {
  assert.match(dashboardPage, /reconcileStaleCompanyCheckout/, 'dashboard invokes bounded stale reconciliation')
  assert.match(dashboardPage, /status === 'CHECKOUT_PENDING'/, 'only reconciles a pending row')
  assert.match(dashboardPage, /SubscriptionService\./, 'uses the canonical subscription lifecycle service')
})

test('dashboard reconciliation never touches ACTIVE subscriptions', () => {
  // The server page guards on the subscription status before reconciling, and
  // the service method itself only mutates CHECKOUT_PENDING rows.
  assert.match(dashboardPage, /status === 'CHECKOUT_PENDING'/)
  const block = subscriptionService.slice(
    subscriptionService.indexOf('static async reconcileStaleCompanyCheckout'),
    subscriptionService.indexOf('// Controlled CompanyAdvertisingPlan deactivation'),
  )
  assert.match(block, /existing\.status !== 'CHECKOUT_PENDING'/)
  assert.match(block, /status: 'EXPIRED'/)
  assert.doesNotMatch(block, /subscriptions\.cancel/, 'never cancels a remote subscription')
})

// ---------------------------------------------------------------------------
// Pending confirmation UX must be temporary and recoverable
// ---------------------------------------------------------------------------

test('dashboard pending confirmation state is bounded, not an indefinite lock', () => {
  assert.match(dashboardClient, /CONFIRMATION_TIMEOUT_MS/, 'bounded confirmation poll')
  assert.match(dashboardClient, /CONFIRMATION_POLL_MS/, 'revalidation interval')
})

test('after confirmation timeout the dashboard offers a recoverable action, not a disabled button', () => {
  // Once confirmation times out while still pending, the primary button is
  // re-enabled and a "Return to plan selection" action is presented.
  assert.match(dashboardClient, /confirmationTimedOut/)
  assert.match(dashboardClient, /Return to plan selection/)
  assert.match(dashboardClient, /isPending && !confirmationTimedOut/, 'button no longer disabled indefinitely on pending')
})

test('dashboard checkout navigation is enabled again after confirmation timeout', () => {
  assert.match(dashboardClient, /isPending && !confirmationTimedOut\) return/)
})

// ---------------------------------------------------------------------------
// Cancelled checkout returns to plan selection
// ---------------------------------------------------------------------------

test('Stripe cancel_url returns the company to plan selection', () => {
  assert.match(checkout, /cancel_url:.*\/company\/subscription\/select/)
})

// ---------------------------------------------------------------------------
// Success path is dashboard-backed with a temporary confirming state, and the
// webhook (not the success URL) is the source of truth for ACTIVE
// ---------------------------------------------------------------------------

test('webhook remains the authoritative activator (no false ACTIVE from success URL)', () => {
  assert.match(webhook, /case 'checkout\.session\.completed'/)
  assert.match(webhook, /reconcileCompanyCheckoutExpired/)
  // The dashboard success-render only shows a temporary pending state; ACTIVE
  // is established by updateCompanySubscriptionFromStripe from the webhook.
  assert.match(subscriptionService, /static async updateCompanySubscriptionFromStripe/)
  assert.match(checkout, /subscription=success/)
})

// ---------------------------------------------------------------------------
// Retry / fresh checkout is available for an abandoned pending row
// ---------------------------------------------------------------------------

test('checkout route reconciles stale pending before creating a fresh session', () => {
  assert.match(checkout, /reconcileStaleCompanyCheckout/)
  assert.match(checkout, /existing\?\.status === 'CHECKOUT_PENDING'/)
})

test('company plan selection supports retry and coupon revalidation', () => {
  assert.match(selectPage, /\/api\/company\/subscription\/checkout/)
  assert.match(selectPage, /couponCode: couponState === 'applied' \? couponAppliedCode : ''/)
})
