import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const read = (relative: string): string => fs.readFileSync(path.join(ROOT, relative), 'utf8')

// ---------------------------------------------------------------------------
// PHASE 4 — CompanyAdvertisingPlan deactivation ("deactivate plan and cancel
// active subscriptions")
// ---------------------------------------------------------------------------
// The audit confirmed plans could only be soft-deactivated while the plan had
// no active subscribers (PATCH returned 409 otherwise). This phase adds a
// controlled POST deactivate endpoint that cancels active subscriptions (with
// immediate-cancel semantics matching the existing company cancel route), then
// deactivates the plan — and NEVER deletes the Stripe Product/Price or the
// plan row.
// ---------------------------------------------------------------------------

const service = read('lib/subscription.ts')
const route = read('app/api/admin/company-advertising-plans/[id]/deactivate/route.ts')

test('deactivate endpoint exists, is admin-only, and delegates to the canonical service', () => {
  assert.match(route, /POST/)
  assert.match(route, /getCurrentUser\(\)/)
  assert.match(route, /user\.role !== 'ADMIN'/)
  assert.match(route, /SubscriptionService\.deactivateCompanyAdvertisingPlan\(id\)/)
})

test('deactivation uses the billing lock to serialize concurrent runs', () => {
  assert.match(service, /withBillingLock\(`company-plan:\$\{planId\}`/)
})

test('deactivation only considers active subscriptions of the plan', () => {
  // The query follows the FK from CompanySubscription.advertisingPlan, so every
  // row belongs to the Company Advertising product.
  assert.match(service, /subscriptions: \{ where: \{ isActive: true \} \}/)
  assert.match(service, /include: \{ subscriptions: \{ where: \{ isActive: true \} \} \}/)
})

test('already-inactive plan is a no-op (idempotent, no cancellation)', () => {
  assert.match(service, /if \(!plan\.isActive\) return \{ deactivated: false, cancelledSubscriptions: 0 \}/)
})

test('every active Stripe subscription is cancelled with a deterministic idempotency key', () => {
  assert.match(service, /subscriptions\.cancel\(remote\.id, \{\}, \{ idempotencyKey: `company_plan_deactivate_\$\{planId\}_\$\{remote\.id\}` \}\)/)
})

test('ownership is verified (customer + company metadata) before cancellation', () => {
  assert.match(service, /remote\.customer !== sub\.stripeCustomerId/)
  assert.match(service, /customer\.deleted/)
  assert.match(service, /customer\.metadata\?\.companyId && customer\.metadata\.companyId !== sub\.companyId/)
})

test('local state is reconciled to canceled after a successful remote cancel', () => {
  assert.match(service, /updateCompanySubscriptionFromStripe\(sub\.stripeCustomerId, remote\.id, 'canceled'\)/)
})

test('a local-only CHECKOUT_PENDING row is expired locally, never cancelled remotely', () => {
  assert.match(service, /sub\.status === 'CHECKOUT_PENDING'/)
  assert.match(service, /status: 'EXPIRED', isActive: false/)
})

test('plan is only deactivated after every active subscription is cancelled', () => {
  // The plan update happens after the cancellation loop, and only when no
  // failures were recorded.
  assert.match(service, /failedIds\.length > 0/)
  assert.match(service, /throw new PlanDeactivationError/)
  assert.match(service, /isActive: false \}\)/)
})

test('partial failure leaves the plan ACTIVE and reports failed company IDs', () => {
  assert.match(service, /PlanDeactivationError\(/)
  assert.match(service, /failedCompanySubscriptionIds: string\[\]/)
  // The plan update must come after the error check so it is never reached on failure.
  const planUpdateIndex = service.lastIndexOf('await prisma.companyAdvertisingPlan.update')
  const failureCheckIndex = service.lastIndexOf('if (failedIds.length > 0)')
  assert.ok(failureCheckIndex > -1 && planUpdateIndex > failureCheckIndex, 'plan deactivation update happens only after the failure check')
})

test('Stripe Product/Price are never deleted during deactivation', () => {
  // No products.del / prices.del / delete calls in the deactivation block.
  const block = service.slice(service.indexOf('deactivateCompanyAdvertisingPlan'), service.indexOf('updateCompanySubscriptionFromStripe'))
  assert.doesNotMatch(block, /products\.del|prices\.del|\.delete\(/)
  assert.doesNotMatch(block, /prisma\.companyAdvertisingPlan\.delete/)
})

test('deactivate route returns failed IDs with a retryable 409 on partial failure', () => {
  assert.match(route, /instanceof PlanDeactivationError/)
  assert.match(route, /failedCompanySubscriptionIds: error\.failedCompanySubscriptionIds/)
  assert.match(route, /status: 409/)
})

test('deactivate route returns 409 for an already-deactivated plan', () => {
  assert.match(route, /already deactivated/)
  assert.match(route, /status: 409/)
})

test('deactivate route returns 404 for an unknown plan and 401 for non-admin', () => {
  assert.match(route, /Plan not found/)
  assert.match(route, /status: 404/)
  assert.match(route, /Unauthorized/)
  assert.match(route, /status: 401/)
})

test('plain PATCH deactivation is still blocked while active subscribers exist', () => {
  const patchRoute = read('app/api/admin/company-advertising-plans/[id]/route.ts')
  assert.match(patchRoute, /update\.isActive === false && hasActiveSubscriptions > 0/)
  assert.match(patchRoute, /Deactivate those subscriptions before deactivating the plan\./)
})
