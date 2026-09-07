import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')
const esc = (token: string) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// ---------------------------------------------------------------------------
// Phase 8.28 — Broker subscription UI cleanup
//
// The broker subscription/plan-selection surface must focus exclusively on
// plan content: available plans, pricing, features, current subscription
// status, checkout/selection, and subscription notices. It must NOT display
// Contact Messages or Bank Partners, and no longer fetches those relations
// purely to render removed subscription UI. Shared data models, admin/public
// functionality, and the entire subscription architecture (plans, resolver,
// checkout, lifecycle, webhook) stay untouched.
// ---------------------------------------------------------------------------

const REMOVED_TOKENS = ['Bank Partners', 'Contact Messages', 'bankPartners', 'contactMessages']

// ---------------------- UsageStats component ----------------------

test('UsageStats renders no Bank Partners or Contact Messages', () => {
  const stats = read('components/sections/subscriptions/Usagestats.tsx')
  for (const token of [
    'Bank Partners',
    'Contact Messages',
    'bankPartners',
    'contactMessages',
    'Number of bank partnerships',
    'Messages received',
    'Banknote',
    'FileText',
  ]) {
    assert.doesNotMatch(stats, new RegExp(esc(token)), `UsageStats must not render ${token}`)
  }
  assert.match(stats, /Profile Views/)
  assert.match(stats, /Reviews/)
  assert.match(stats, /Active Subscription/)
  assert.match(stats, /No usage data available/)
})

test('UsageStats stays wired into the broker subscription page', () => {
  const page = read('app/broker/subscription/page.tsx')
  assert.match(page, /from '@\/components\/sections\/subscriptions\/Usagestats'/)
  assert.match(page, /<UsageStats usageData=\{usageData\}/)
})

// ---------------------- Subscription pages ----------------------

test('no broker subscription page renders the removed categories or dashboard-style metrics', () => {
  const files = [
    'app/broker/subscription/page.tsx',
    'app/broker/subscription/select/page.tsx',
    'app/broker/subscription/billing/page.tsx',
    'app/broker/subscription/success/page.tsx',
    'app/broker/subscription/upgrade/page.tsx',
  ]
  for (const file of files) {
    const src = read(file)
    for (const token of REMOVED_TOKENS) {
      assert.doesNotMatch(src, new RegExp(esc(token)), `${file} must not render ${token}`)
    }
    for (const metric of ['successRate', 'responseRate', 'avgProcessingTime', 'totalLoansProcessed']) {
      assert.doesNotMatch(src, new RegExp(esc(metric)), `${file} must not render ${metric}`)
    }
  }
})

test('Billing components keep only their financial UI (no bank partners or contact messages)', () => {
  for (const file of [
    'components/sections/subscriptions/BillingHistory.tsx',
    'components/sections/subscriptions/BillingClient.tsx',
    'components/sections/subscriptions/Payment.tsx',
    'components/sections/subscriptions/SubscriptionPlan.tsx',
  ]) {
    const src = read(file)
    for (const token of REMOVED_TOKENS) {
      assert.doesNotMatch(src, new RegExp(esc(token)), `${file} must not render ${token}`)
    }
  }
})

// ---------------------- Data-minimized queries ----------------------

test('GET /api/subscription/usage no longer fetches bank partners or contact messages', () => {
  const route = read('app/api/subscription/usage/route.ts')
  assert.doesNotMatch(route, /bankPartners:\s*true/)
  assert.doesNotMatch(route, /contactMessages:\s*\{/)
  assert.doesNotMatch(route, /broker\.bankPartners/)
  assert.doesNotMatch(route, /broker\.contactMessages/)
  assert.doesNotMatch(route, /loanProducts/)
  assert.doesNotMatch(route, /bankPartners:/)
  assert.match(route, /reviews: true/)
  assert.match(route, /SubscriptionService\.effectiveSubscription/)
  assert.match(route, /listBrokerPlansPublic/)
  assert.match(route, /planInfo: currentPlanInfo/)
})

test('SubscriptionService.getUsageStats no longer fetches bank partners or contact messages', () => {
  const source = read('lib/subscription.ts')
  const block = source.slice(
    source.indexOf('static async getUsageStats'),
    source.indexOf('static async canUpgrade'),
  )
  assert.doesNotMatch(block, /bankPartners:\s*true/)
  assert.doesNotMatch(block, /contactMessages:\s*\{/)
  assert.doesNotMatch(block, /broker\.bankPartners/)
  assert.doesNotMatch(block, /broker\.contactMessages/)
  assert.doesNotMatch(block, /loanProducts/)
  assert.match(block, /profileViews/)
  assert.match(block, /listBrokerPlansPublic/)
})

// ---------------------- Plan rendering (FREE + FEATURED) ----------------------

test('FREE plan still renders in the Plans & Pricing tab', () => {
  const plans = read('components/sections/subscriptions/SubscriptionPlan.tsx')
  assert.match(plans, /plan\.price === 0/)
  assert.match(plans, /No credit card required/)
  assert.match(plans, /Get Started/)
  assert.match(plans, /handleSelect/)
})

test('FEATURED / Mortgage Expert plan still renders', () => {
  const plans = read('components/sections/subscriptions/SubscriptionPlan.tsx')
  assert.match(plans, /plan\.code === 'FEATURED'/)
  assert.match(plans, /Most Popular/)
  const select = read('app/broker/subscription/select/page.tsx')
  assert.match(select, /VALID_PLAN_CODES = \['FREE', 'FEATURED'\]/)
  assert.match(select, /isPopular=\{plan\.code === 'FEATURED'\}/)
})

// ---------------------- Checkout / selection unchanged ----------------------

test('plan selection and checkout endpoints are unchanged', () => {
  const select = read('app/broker/subscription/select/page.tsx')
  assert.match(select, /fetch\('\/api\/subscription\/plans'\)/)
  assert.match(select, /fetch\('\/api\/broker-registration\/subscription\/free'/)
  assert.match(select, /fetch\('\/api\/broker-registration\/subscription\/checkout'/)
  const page = read('app/broker/subscription/page.tsx')
  assert.match(page, /fetch\('\/api\/subscription\/checkout'/)
  assert.match(page, /fetch\('\/api\/subscription\/portal'/)
})

test('subscription state (plan, active, dates) is still returned by the usage endpoint', () => {
  const route = read('app/api/subscription/usage/route.ts')
  assert.match(route, /subscription: \{\n\s+plan,\n\s+isActive: subscription\.isActive,\n\s+startDate: subscription\.startDate,\n\s+endDate: subscription\.endDate,/)
})

// ---------------------- Admin / public functionality intact ----------------------

test('admin contact-message functionality remains intact', () => {
  const admin = read('lib/admin/dashboard.ts')
  assert.match(admin, /prisma\.contactMessage\.count/)
  assert.match(admin, /prisma\.contactMessage\.findMany/)
  const messagesPage = read('app/broker/messages/page.tsx')
  assert.match(messagesPage, /useMyContactMessages/)
})

test('bank partners remain a first-class model and public marketing surface but no longer ship in the detail DTO', () => {
  const publicBroker = read('lib/public-broker.ts')
  assert.doesNotMatch(publicBroker, /publicBankPartners/)
  assert.doesNotMatch(publicBroker, /bankPartners:/)
  const featured = read('app/api/brokers/featured/route.ts')
  assert.match(featured, /bankName/)
  const company = read('components/sections/broker/CompanyProfile.tsx')
  assert.match(company, /Bank Partnerships/)
})

// ---------------------- Models / subscription architecture unchanged ----------------------

test('prisma schema still defines the bank-partner and contact-message models and relations', () => {
  const schema = read('prisma/schema.prisma')
  assert.match(schema, /model BrokerBank \{/)
  assert.match(schema, /model ContactMessage \{/)
  assert.match(schema, /bankPartners BrokerBank\[\]/)
  assert.match(schema, /contactMessages ContactMessage\[\]/)
})

test('subscription architecture and lifecycle are untouched', () => {
  const subscription = read('lib/subscription.ts')
  assert.match(subscription, /getPlanForStripePrice/)
  assert.match(subscription, /effectiveSubscription/)
  assert.match(subscription, /listBrokerPlansPublic/)
  const checkout = read('app/api/subscription/checkout/route.ts')
  assert.match(checkout, /success_url:/)
  assert.match(checkout, /session_id=\{CHECKOUT_SESSION_ID\}/)
  const webhook = read('app/api/stripe/webhook/route.ts')
  assert.match(webhook, /checkout\.session\.completed/)
})