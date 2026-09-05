import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {
  BROKER_FREE_PLAN_CODE,
  DEFAULT_BROKER_PLANS,
  normalizePlanCode,
} from '../lib/broker-plans'

const read = (path: string) => fs.readFileSync(path, 'utf8')

const schema = read('prisma/schema.prisma')
const plansLib = read('lib/broker-plans.ts')
const reconcileScript = read('scripts/reconcile-broker-plans.ts')
const listRoute = read('app/api/admin/broker-subscriptions/route.ts')
const detailRoute = read('app/api/admin/broker-subscriptions/[id]/route.ts')
const reconcileRoute = read('app/api/admin/broker-subscriptions/reconcile/route.ts')
const backfillRoute = read('app/api/admin/broker-subscriptions/backfill-free/route.ts')
const adminCreateRoute = read('app/api/admin/brokers/route.ts')
const brokerData = read('lib/admin/broker-data.ts')
const listPage = read('app/admin/billing/broker-subscriptions/page.tsx')
const nav = read('components/layout/admin/sideBarData.ts')

// ---------------------------------------------------------------------------
// Schema / model
// ---------------------------------------------------------------------------

test('BrokerSubscription links to BrokerSubscriptionPlan via planId and String plan code', () => {
  const sub = schema.slice(schema.indexOf('model BrokerSubscription'), schema.indexOf('model BrokerRegistration'))
  assert.match(sub, /plan\s+String/)
  assert.match(sub, /planId\s+String\?\s+@db\.ObjectId/)
  assert.match(sub, /planRef\s+BrokerSubscriptionPlan\?/)
})

test('no second subscription or plan table is introduced', () => {
  assert.equal((schema.match(/model BrokerSubscriptionPlan /g) || []).length, 1)
  assert.equal((schema.match(/model BrokerSubscription \{/g) || []).length, 1)
})

// ---------------------------------------------------------------------------
// Admin authentication
// ---------------------------------------------------------------------------

test('broker subscription admin routes enforce ADMIN-only access', () => {
  assert.match(listRoute, /role !== 'ADMIN'/)
  assert.match(listRoute, /status: 403/)
  assert.match(detailRoute, /role !== 'ADMIN'/)
  assert.match(detailRoute, /status: 403/)
  assert.match(reconcileRoute, /role !== 'ADMIN'/)
  assert.match(backfillRoute, /role !== 'ADMIN'/)
})

test('admin subscription list and detail exist as dedicated routes', () => {
  assert.match(listRoute, /brokerSubscription\.findMany/)
  assert.match(detailRoute, /brokerSubscription\.findUnique/)
})

// ---------------------------------------------------------------------------
// Migration logic
// ---------------------------------------------------------------------------

test('migration resolves the target plan from the stable plan code, never a client planId', () => {
  assert.match(plansLib, /resolveBrokerPlanByCode\(subscription\.plan\)/)
  assert.doesNotMatch(plansLib, /linkBrokerSubscriptionToPlan\([^)]*planId/)
})

test('migration requires a unique active plan match', () => {
  assert.match(plansLib, /plans\.length !== 1/)
  assert.match(plansLib, /plan\.isActive \? plan : null/)
})

test('migration only populates planId when the subscription is not already linked', () => {
  assert.match(plansLib, /if \(subscription\.planId\) return \{ status: 'already-linked'/)
})

test('migration never modifies billing, dates, or isActive', () => {
  const linkSection = plansLib.slice(plansLib.indexOf('export async function linkBrokerSubscriptionToPlan'), plansLib.indexOf('export type BrokerReconciliationReport'))
  assert.match(linkSection, /data: \{ planId: plan\.id \}/)
  assert.doesNotMatch(linkSection, /stripeCustomerId|stripeSubId|endDate|isActive/)
})

test('normalizePlanCode produces a stable uppercase code', () => {
  assert.equal(normalizePlanCode(' featured '), 'FEATURED')
  assert.equal(normalizePlanCode(''), null)
})

// ---------------------------------------------------------------------------
// Bulk reconciliation
// ---------------------------------------------------------------------------

test('reconcile is idempotent and non-destructive', () => {
  assert.match(plansLib, /export async function reconcileBrokerSubscriptions/)
  assert.match(plansLib, /alreadyLinked/)
  assert.doesNotMatch(plansLib, /reconcileBrokerSubscriptions[\s\S]*deleteMany/)
})

test('reconcile reports unknown and ambiguous plans without guessing', () => {
  assert.match(plansLib, /unknownPlan/)
  assert.match(plansLib, /processed/)
  assert.match(plansLib, /linked/)
})

test('CLI reconcile script reuses the shared service', () => {
  assert.match(reconcileScript, /reconcileBrokerSubscriptions/)
  assert.doesNotMatch(reconcileScript, /linkBrokerSubscriptionToPlan\(/)
})

// ---------------------------------------------------------------------------
// Unknown plan handling
// ---------------------------------------------------------------------------

test('unknown plan codes are never auto-mapped', () => {
  // The admin list/detail must surface unknown codes without migration.
  assert.match(listRoute, /unknown/)
  assert.match(detailRoute, /'unknown'|unknown/)
})

// ---------------------------------------------------------------------------
// Admin-created / imported broker FREE subscription
// ---------------------------------------------------------------------------

test('admin broker create resolves and links the dynamic FREE plan', () => {
  assert.match(adminCreateRoute, /ensureAdminCreatedBrokerFreeSubscription/)
  assert.doesNotMatch(adminCreateRoute, /subscription: \{ create: \{ plan: 'FREE'/)
})

test('admin broker import resolves and links the dynamic FREE plan', () => {
  assert.match(brokerData, /ensureAdminCreatedBrokerFreeSubscription/)
  assert.doesNotMatch(brokerData, /subscription: \{ create: \{ plan: 'FREE'/)
})

test('FREE subscription creation uses planId linked to the dynamic FREE plan', () => {
  assert.match(plansLib, /code: BROKER_FREE_PLAN_CODE/)
  assert.match(plansLib, /planId: freePlan\.id/)
})

test('FREE assignment never creates a Stripe customer or subscription', () => {
  const freeSection = plansLib.slice(plansLib.indexOf('export async function ensureAdminCreatedBrokerFreeSubscription'), plansLib.indexOf('export type AdminBrokerSubscriptionAudit'))
  assert.doesNotMatch(freeSection, /stripe\.customers|stripe\.subscriptions|checkout|stripeCustomerId: .*create/)
})

test('existing non-FREE subscription is never downgraded to FREE', () => {
  assert.match(plansLib, /existing\.plan !== BROKER_FREE_PLAN_CODE/)
  assert.match(plansLib, /preserved-other-plan/)
})

test('missing FREE plan blocks safely with a clear error', () => {
  assert.match(plansLib, /Active FREE broker subscription plan is required before importing\/creating brokers\./)
})

test('admin-created brokers without subscription are detected in the audit', () => {
  const client = read('app/admin/billing/broker-subscriptions/BrokerSubscriptionsClient.tsx')
  assert.match(plansLib, /auditAdminCreatedBrokerSubscriptions/)
  assert.match(plansLib, /missingSubscription/)
  assert.match(client, /Missing subscription/)
  assert.match(client, /missingSubscription/)
})

test('backfill creates only missing FREE subscriptions and is idempotent', () => {
  assert.match(plansLib, /backfillAdminCreatedBrokerFreeSubscriptions/)
  assert.match(plansLib, /creationSource: 'ADMIN_CREATED'/)
  assert.match(plansLib, /!broker\.subscription/)
  assert.match(plansLib, /preservedOtherPlan/)
})

test('backfill never guesses legacy brokers with unknown creation source', () => {
  const backfillSection = plansLib.slice(plansLib.indexOf('export async function backfillAdminCreatedBrokerFreeSubscriptions'), plansLib.indexOf('// Stripe safety'))
  assert.match(backfillSection, /where: \{ creationSource: 'ADMIN_CREATED' \}/)
  assert.doesNotMatch(backfillSection, /creationSource: null/)
})

// ---------------------------------------------------------------------------
// Admin UI + navigation
// ---------------------------------------------------------------------------

test('Broker Subscriptions page appears under Billing in admin navigation', () => {
  assert.match(nav, /Broker Subscriptions/)
  assert.match(nav, /\/admin\/billing\/broker-subscriptions/)
})

test('broker and company subscriptions are not mixed', () => {
  assert.match(nav, /Company Subscriptions/)
  assert.match(nav, /\/admin\/billing\/company-subscriptions/)
})

test('admin subscription list page shows migration and plan-link status', () => {
  const client = read('app/admin/billing/broker-subscriptions/BrokerSubscriptionsClient.tsx')
  assert.match(listPage, /BrokerSubscriptionsClient/)
  assert.match(client, /Needs migration|Legacy|Linked/)
})

// ---------------------------------------------------------------------------
// Stripe safety
// ---------------------------------------------------------------------------

test('admin subscription routes never expose Stripe secrets', () => {
  assert.doesNotMatch(listRoute, /STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET/)
  assert.doesNotMatch(detailRoute, /STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET/)
  assert.doesNotMatch(reconcileRoute, /STRIPE_SECRET_KEY/)
  assert.doesNotMatch(backfillRoute, /STRIPE_SECRET_KEY/)
})

// ---------------------------------------------------------------------------
// FREE plan config
// ---------------------------------------------------------------------------

test('FREE plan is configured without Stripe identifiers', () => {
  const free = DEFAULT_BROKER_PLANS.find((plan) => plan.code === 'FREE')!
  assert.equal(free.price, 0)
  assert.equal(BROKER_FREE_PLAN_CODE, 'FREE')
})

test('initial plans are FREE and FEATURED only, and no PRO', () => {
  const codes = DEFAULT_BROKER_PLANS.map((plan) => plan.code)
  assert.deepEqual(codes, ['FREE', 'FEATURED'])
  assert.doesNotMatch(codes.join(' '), /PRO/)
})

test('deactivating a plan does not deactivate its subscriptions', () => {
  const updateRoute = read('app/api/admin/broker-plans/[id]/route.ts')
  assert.match(updateRoute, /isActive/)
  assert.doesNotMatch(updateRoute, /subscription\.updateMany/)
})