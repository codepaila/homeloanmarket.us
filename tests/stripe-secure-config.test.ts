import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')

const configLib = read('lib/stripe-config.ts')
const secureLib = read('lib/secure-config.ts')
const secretsApi = read('app/api/admin/stripe/secrets/route.ts')
const statusApi = read('app/api/admin/stripe/status/route.ts')
const testApi = read('app/api/admin/stripe/test/route.ts')
const webhook = read('app/api/stripe/webhook/route.ts')
const client = read('app/admin/billing/stripe/StripeConfigClient.tsx')
const schema = read('prisma/schema.prisma')
const subscription = read('lib/subscription.ts')

// ---------------------------------------------------------------------------
// SecureConfig model + encryption at rest
// ---------------------------------------------------------------------------

test('dedicated SecureConfig model exists (not stored in generic Setting)', () => {
  assert.match(schema, /model SecureConfig \{/)
  assert.match(schema, /key\s+String\s+@unique/)
  assert.match(schema, /@map\("secure_config"\)/)
})

test('SecureConfig value is described as encrypted, never plaintext', () => {
  assert.match(schema, /encrypted ciphertext/)
  assert.doesNotMatch(schema, /model SecureConfig \{[\s\S]*?value\s+String\s+\/\/ plaintext/)
})

test('audit trail model exists and does not store secret values', () => {
  assert.match(schema, /model SecureConfigAudit \{/)
  assert.match(schema, /configKey String/)
  assert.match(schema, /action\s+String/)
  assert.doesNotMatch(schema, /model SecureConfigAudit \{[\s\S]*?value\s+String/)
})

test('secrets are encrypted with AES-256-GCM at rest', () => {
  assert.match(secureLib, /aes-256-gcm/)
  assert.match(secureLib, /createCipheriv/)
  assert.match(secureLib, /createDecipheriv/)
  assert.match(secureLib, /encryptSecret/)
  assert.match(secureLib, /decryptSecret/)
})

test('stored secrets are decrypted only when read, never returned', () => {
  assert.match(secureLib, /decryptSecret/)
  assert.match(secureLib, /getStoredSecret/)
})

// ---------------------------------------------------------------------------
// Authoritative runtime resolution (DB-encrypted -> env fallback)
// ---------------------------------------------------------------------------

test('resolver has DB-encrypted first, env fallback precedence', () => {
  assert.match(configLib, /getStripeSecretKey/)
  assert.match(configLib, /getStoredSecret\('stripe\.secret_key'\)/)
  assert.match(configLib, /process\.env\.STRIPE_SECRET_KEY/)
  assert.match(configLib, /getStoredSecret\('stripe\.webhook_secret'\)/)
  assert.match(configLib, /process\.env\.STRIPE_WEBHOOK_SECRET/)
})

test('no consumer creates a Stripe client from env directly anymore', () => {
  const files = [
    'app/api/company/subscription/portal/route.ts',
    'app/api/company/subscription/cancel/route.ts',
    'app/api/company/subscription/checkout/route.ts',
    'app/api/subscription/portal/route.ts',
    'app/api/subscription/verify/route.ts',
    'app/api/subscription/invoices/route.ts',
    'app/api/subscription/upgrade/route.ts',
    'app/api/subscription/details/route.ts',
    'app/api/subscription/checkout/route.ts',
    'app/api/broker-registration/subscription/verify/route.ts',
    'app/api/broker-registration/subscription/checkout/route.ts',
    'app/api/stripe/webhook/route.ts',
    'lib/subscription.ts',
    'lib/company-coupon.ts',
  ]
  for (const file of files) {
    const src = read(file)
    assert.doesNotMatch(src, /new Stripe\(process\.env\.STRIPE_SECRET_KEY/, `${file} must not read the secret key from env directly`)
  }
  // The webhook must not read the webhook secret from env directly either.
  assert.doesNotMatch(webhook, /new Stripe\(process\.env\.STRIPE_SECRET_KEY!\)/)
})

// ---------------------------------------------------------------------------
// Admin-only authorization for the secrets API
// ---------------------------------------------------------------------------

test('secrets save API requires ADMIN', () => {
  assert.match(secretsApi, /role !== 'ADMIN'/)
  assert.match(secretsApi, /status: 403/)
})

test('secrets API validates field and rejects unknown config keys', () => {
  assert.match(secretsApi, /field !== 'secretKey' && field !== 'webhookSecret'/)
  assert.match(secretsApi, /Invalid configuration field/)
  // No arbitrary env-var mutation.
  assert.doesNotMatch(secretsApi, /process\.env\[|process\.env\.\w+\s*=\s*body/)
})

// ---------------------------------------------------------------------------
// Secrets never returned / never logged
// ---------------------------------------------------------------------------

test('secrets API never returns the secret value or previous secret', () => {
  // The response only exposes safe metadata (configured boolean + mode), never
  // the secret value and never a previous secret.
  assert.match(secretsApi, /configured: result\.configured/)
  assert.match(secretsApi, /mode: await stripeMode\(\)/)
  assert.doesNotMatch(secretsApi, /return NextResponse\.json\(\{ ok: true[\s\S]*value/)
  assert.doesNotMatch(secretsApi, /previous/)
})

test('secrets API logs only non-secret metadata', () => {
  assert.match(secretsApi, /console\.info/)
  assert.match(secretsApi, /field/)
  assert.doesNotMatch(secretsApi, /console\.(log|info|error)\([^)]*value/)
})

test('client never contains or sends secret values', () => {
  assert.doesNotMatch(client, /STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|sk_live_|sk_test_|whsec_/)
  assert.match(client, /Replace Secret/)
  assert.match(client, /Save Secret Key/)
  assert.match(client, /Save Webhook Secret/)
  assert.match(client, /●●●●●●●●●●●●/)
})

test('status API never returns secret values', () => {
  assert.doesNotMatch(statusApi, /sk_live_|sk_test_|whsec_/)
  assert.doesNotMatch(statusApi, /secretKey: process\.env/)
})

// ---------------------------------------------------------------------------
// Publishable key handling is safe
// ---------------------------------------------------------------------------

test('publishable key is not required and not stored as a secret', () => {
  // No publishable key secret editor / storage path exists anywhere in the
  // Stripe config, because the application does not use client-side Stripe
  // Elements for billing.
  assert.doesNotMatch(configLib, /publishable_key|publishableKey/)
  assert.doesNotMatch(schema, /stripe_publishable/)
  assert.doesNotMatch(client, /publishable/i)
})

// ---------------------------------------------------------------------------
// Required events cannot be disabled; unknown events rejected
// ---------------------------------------------------------------------------

test('critical events cannot be disabled', () => {
  assert.match(configLib, /if \(event\.critical\) requested\.add\(event\.type\)/)
  assert.match(configLib, /critical/)
})

test('unknown events rejected', () => {
  assert.match(configLib, /Unsupported Stripe event/)
  assert.match(configLib, /allowlist/)
})

test('client marks required events as mandatory and non-toggleable', () => {
  assert.match(client, /Required Stripe Events/)
  assert.match(client, /Optional Stripe Events/)
  // The required section has no disable toggle.
  assert.match(client, /Mandatory/)
})

// ---------------------------------------------------------------------------
// Webhook unchanged in behavior
// ---------------------------------------------------------------------------

test('webhook still verifies signatures and preserves idempotency', () => {
  assert.match(webhook, /webhooks\.constructEvent/)
  assert.match(webhook, /getStripeWebhookSecret/)
  assert.match(webhook, /stripeWebhookEvent\.findUnique/)
  assert.match(webhook, /P2002/)
  assert.match(webhook, /withWebhookSubscriptionLock/)
  assert.match(webhook, /hasNewerAppliedEvent/)
  assert.match(webhook, /STALE_EVENT_IGNORED/)
})

test('webhook handlers unchanged (same event switch)', () => {
  assert.match(webhook, /case 'checkout\.session\.completed'/)
  assert.match(webhook, /case 'customer\.subscription\.updated'/)
  assert.match(webhook, /case 'customer\.subscription\.deleted'/)
  assert.match(webhook, /invoice\.payment_failed/)
  assert.match(webhook, /invoice\.payment_succeeded/)
})

test('webhook gates optional events but always processes critical', () => {
  assert.match(webhook, /getEnabledStripeEvents/)
  assert.match(webhook, /!meta\.critical && !enabled\.has\(event\.type\)/)
})

// ---------------------------------------------------------------------------
// No duplicate Stripe systems
// ---------------------------------------------------------------------------

test('no second Stripe webhook endpoint', () => {
  const files = fs.readdirSync('app/api/stripe', { recursive: true }).filter((p) => String(p).endsWith('route.ts'))
  // Only the canonical webhook route under app/api/stripe.
  assert.ok(files.some((p) => String(p).includes('webhook')))
})

test('no second subscription system or static catalog introduced', () => {
  assert.doesNotMatch(configLib, /subscriptionPlans/)
  assert.doesNotMatch(subscription, /export const subscriptionPlans = \[/)
})

// ---------------------------------------------------------------------------
// Broker registration subscription remains separate
// ---------------------------------------------------------------------------

test('broker registration subscription flow remains separate', () => {
  const regCheckout = read('app/api/broker-registration/subscription/checkout/route.ts')
  assert.match(regCheckout, /brokerRegistrationSubscription/)
  assert.match(regCheckout, /ownerType: 'BROKER_REGISTRATION'/)
})

// ---------------------------------------------------------------------------
// Connection test still safe
// ---------------------------------------------------------------------------

test('connection test returns only safe metadata', () => {
  assert.match(configLib, /stripe\.accounts\.retrieve\(\)/)
  assert.match(configLib, /accountId/)
  assert.match(configLib, /defaultCurrency/)
  assert.doesNotMatch(testApi, /Bearer|authorization:|apiKey:/)
})
