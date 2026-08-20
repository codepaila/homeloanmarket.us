import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')
const exists = (path: string) => fs.existsSync(path)

const configLib = read('lib/stripe-config.ts')
const statusApi = read('app/api/admin/stripe/status/route.ts')
const testApi = read('app/api/admin/stripe/test/route.ts')
const eventsApi = read('app/api/admin/stripe/events/route.ts')
const webhook = read('app/api/stripe/webhook/route.ts')
const client = exists('app/admin/billing/stripe/StripeConfigClient.tsx') ? read('app/admin/billing/stripe/StripeConfigClient.tsx') : ''
const nav = read('lib/admin/navigation.ts')

// ---------------------------------------------------------------------------
// 1. Admin page + navigation exist
// ---------------------------------------------------------------------------

test('Stripe Configuration admin page exists', () => {
  assert.ok(exists('app/admin/billing/stripe/page.tsx'), 'page missing')
  assert.ok(exists('app/admin/billing/stripe/StripeConfigClient.tsx'), 'client missing')
})

test('Stripe Configuration appears in the rendered admin navigation (Billing group)', () => {
  assert.match(nav, /label: 'Stripe Configuration', href: '\/admin\/billing\/stripe'/)
  assert.match(nav, /label: 'Billing'/)
})

test('Stripe Configuration nav is admin-only (inside adminNavigation)', () => {
  const adminBlock = nav.slice(nav.indexOf('export const adminNavigation'), nav.indexOf('export function isAdminNavItemActive'))
  assert.match(adminBlock, /Stripe Configuration/)
  assert.match(adminBlock, /Broker Plans/)
})

// ---------------------------------------------------------------------------
// 2. Admin-only authorization
// ---------------------------------------------------------------------------

test('all Stripe config APIs require ADMIN (non-admin 403)', () => {
  assert.match(statusApi, /role !== 'ADMIN'/ )
  assert.match(statusApi, /status: 403/)
  assert.match(testApi, /role !== 'ADMIN'/)
  assert.match(testApi, /status: 403/)
  assert.match(eventsApi, /role !== 'ADMIN'/)
  assert.match(eventsApi, /status: 403/)
})

// ---------------------------------------------------------------------------
// 3. Secret values never returned or rendered
// ---------------------------------------------------------------------------

test('secret key / webhook secret values are never returned by APIs', () => {
  // The status API returns only booleans for configured/unconfigured state, never
  // the env var value. It reads env vars only inside the lib (server-side).
  assert.doesNotMatch(statusApi, /STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|sk_live_|sk_test_|whsec_/)
  assert.doesNotMatch(testApi, /sk_live_|sk_test_|whsec_|STRIPE_SECRET_KEY/)
  // The status API surfaces boolean flags (configured), not the secret value.
  assert.match(statusApi, /configured:\s*\{[\s\S]*?secretKey:/)
  assert.doesNotMatch(statusApi, /configured:\s*\{[\s\S]*?secretKey: process\.env/)
})

test('client never renders or sends secret values', () => {
  assert.doesNotMatch(client, /STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|sk_live_|sk_test_|whsec_/)
  assert.match(client, /●●●●●●●●●●●●/)
  assert.match(client, /Configured/)
})

test('no secret stored in the database', () => {
  // The only Setting write is the enabled-events config (an allowlist of event
  // names), never a secret value.
  assert.match(configLib, /key: EVENTS_SETTING_KEY/)
  assert.doesNotMatch(configLib, /value: process\.env\.STRIPE|value: process\.env\.STRIPE_WEBHOOK/)
})

// ---------------------------------------------------------------------------
// 4. Stripe mode
// ---------------------------------------------------------------------------

test('Stripe mode is derived server-side from the secret prefix and never client-switchable', () => {
  assert.match(configLib, /stripeMode\(\)/)
  assert.match(configLib, /sk_test_/)
  assert.match(configLib, /sk_live_/)
  assert.doesNotMatch(client, /setMode|mode.*POST/)
})

// ---------------------------------------------------------------------------
// 5. Webhook configuration
// ---------------------------------------------------------------------------

test('webhook endpoint is the canonical app endpoint, not invented', () => {
  assert.match(configLib, /\/api\/stripe\/webhook/)
  assert.match(configLib, /STRIPE_WEBHOOK_PATH/)
})

test('webhook secret status only, signature verification flag', () => {
  assert.match(configLib, /stripeWebhookSecretConfigured\(\)/)
  assert.match(statusApi, /signatureVerification/)
})

// ---------------------------------------------------------------------------
// 6. Supported events allowlist
// ---------------------------------------------------------------------------

test('supported events are an explicit allowlist matching the webhook handler', () => {
  assert.match(configLib, /SUPPORTED_STRIPE_EVENTS/)
  assert.match(configLib, /checkout\.session\.completed/)
  assert.match(configLib, /customer\.subscription\.updated/)
  assert.match(configLib, /customer\.subscription\.deleted/)
  assert.match(configLib, /invoice\.payment_failed/)
  assert.match(configLib, /invoice\.payment_succeeded/)
  // The webhook switch handles the same events.
  assert.match(webhook, /case 'checkout\.session\.completed'/)
  assert.match(webhook, /case 'customer\.subscription\.updated'/)
  assert.match(webhook, /case 'customer\.subscription\.deleted'/)
  assert.match(webhook, /invoice\.payment_failed/)
})

// ---------------------------------------------------------------------------
// 7. Event enable/disable security
// ---------------------------------------------------------------------------

test('unknown event names are rejected', () => {
  assert.match(configLib, /Unsupported Stripe event/)
  assert.match(configLib, /allowlist|has\(type\)/)
})

test('critical billing events cannot be disabled', () => {
  assert.match(configLib, /critical/)
  assert.match(configLib, /if \(event\.critical\) requested\.add\(event\.type\)/)
})

test('only allowlisted event names can be selected (no arbitrary handler execution)', () => {
  assert.match(configLib, /if \(!allowlist\.has\(type\)\) return \{ ok: false, error: 'Unsupported Stripe event' \}/)
  assert.doesNotMatch(configLib, /eval\(|Function\(|require\(.*event/)
})

test('event configuration is server-side, never client-dependent for handling', () => {
  assert.match(configLib, /getEnabledStripeEvents\(\)/)
  assert.doesNotMatch(eventsApi, /body\.handler|body\.code|body\.function/)
})

// ---------------------------------------------------------------------------
// 8. Webhook gating
// ---------------------------------------------------------------------------

test('webhook gates optional events by persisted config but always processes critical events', () => {
  assert.match(webhook, /getEnabledStripeEvents/)
  assert.match(webhook, /!meta\.critical && !enabled\.has\(event\.type\)/)
  assert.match(webhook, /Stripe webhook event skipped \(disabled by config\)/)
})

test('webhook preserves idempotency and signature verification', () => {
  // Signature verification uses the authoritative resolved webhook secret.
  assert.match(webhook, /webhooks\.constructEvent/)
  assert.match(webhook, /getStripeWebhookSecret/)
  assert.match(webhook, /stripeWebhookEvent\.findUnique/)
  assert.match(webhook, /P2002/)
})

// ---------------------------------------------------------------------------
// 9. Connection test
// ---------------------------------------------------------------------------

test('connection test is a safe server-side Stripe call returning only safe info', () => {
  assert.match(configLib, /stripe\.accounts\.retrieve\(\)/)
  assert.match(configLib, /accountId/)
  assert.match(configLib, /defaultCurrency/)
  // The API responses never embed an authorization header, Bearer token, or raw key.
  assert.doesNotMatch(statusApi, /Bearer|authorization:|apiKey:/)
  assert.doesNotMatch(testApi, /Bearer|authorization:|apiKey:/)
})

test('test API returns sanitized failure and safe success', () => {
  assert.match(testApi, /testStripeConnection/)
  assert.match(testApi, /status: 503/)
  assert.match(testApi, /status: 502/)
})

// ---------------------------------------------------------------------------
// 10. Event log access
// ---------------------------------------------------------------------------

test('event log reuses the existing StripeWebhookEvent model', () => {
  assert.match(configLib, /stripeWebhookEvent\.findMany/)
  assert.doesNotMatch(configLib, /stripeWebhookEvent\.create/)
})

test('event log never exposes secrets or sensitive PII', () => {
  assert.doesNotMatch(statusApi, /stripeCustomerId|stripeSubId|email|name.*customer/)
})

// ---------------------------------------------------------------------------
// 11. Broker / company billing price authority
// ---------------------------------------------------------------------------

test('broker checkout resolves Stripe price from DB plan, not client', () => {
  const checkout = read('app/api/subscription/checkout/route.ts')
  assert.match(checkout, /validateBrokerPlanForCheckout/)
  assert.doesNotMatch(checkout, /body\.stripePriceId|body\.priceId/)
})

test('company checkout resolves Stripe price from DB plan, coupon optional', () => {
  const checkout = read('app/api/company/subscription/checkout/route.ts')
  assert.match(checkout, /plan\.stripePriceId/)
  assert.match(checkout, /validateCompanyCoupon/)
  assert.doesNotMatch(checkout, /body\.stripePriceId|body\.priceId/)
})

// ---------------------------------------------------------------------------
// 12. No static broker plan catalog
// ---------------------------------------------------------------------------

test('no static subscriptionPlans catalog in runtime', () => {
  assert.doesNotMatch(configLib, /subscriptionPlans/)
  const stripeLib = read('lib/stripe.ts')
  assert.doesNotMatch(stripeLib, /export const subscriptionPlans = \[/)
})

// ---------------------------------------------------------------------------
// 13. Billing portal ownership
// ---------------------------------------------------------------------------

test('billing portal uses authenticated owner and server-side secret', () => {
  const portal = read('app/api/company/subscription/portal/route.ts')
  assert.match(portal, /getCurrentCompany/)
  assert.match(portal, /stripe\.billingPortal\.sessions\.create/)
  const brokerPortal = exists('app/api/subscription/portal/route.ts') ? read('app/api/subscription/portal/route.ts') : ''
  if (brokerPortal) assert.match(brokerPortal, /getCurrentUser/)
})

// ---------------------------------------------------------------------------
// 14. No duplicate Stripe system
// ---------------------------------------------------------------------------

test('no second Stripe client/config system created', () => {
  // The config helper creates exactly one Stripe client via stripeClient().
  const count = (configLib.match(/new Stripe\(/g) || []).length
  assert.equal(count, 1)
})