// Shared server-side Stripe operational configuration helpers for the Admin
// Stripe Configuration page. Stripe secrets are NEVER read here from the
// database or returned to the client — they live only in server environment
// variables. This module reports configured/unconfigured status and performs
// safe connection tests.
import Stripe from 'stripe'
import prisma from '@/lib/prisma'
import { baseUrl } from '@/utils/baseUrl'
import { getStoredSecret, isStoredSecretSet, setStoredSecret } from '@/lib/secure-config'

// The application's canonical webhook endpoint (matches app/api/stripe/webhook).
export const STRIPE_WEBHOOK_PATH = '/api/stripe/webhook'
export const STRIPE_WEBHOOK_URL = `${baseUrl}${STRIPE_WEBHOOK_PATH}`

// Authoritative runtime resolution for the Stripe secret key.
// Precedence: encrypted DB value (SecureConfig) -> environment variable.
// Environment variables remain a safe bootstrap/fallback so existing deployed
// environments keep working without database seeding. Full secret values are
// only ever resolved server-side and never returned to any client.
export async function getStripeSecretKey(): Promise<string | null> {
  const stored = await getStoredSecret('stripe.secret_key')
  if (stored) return stored
  return process.env.STRIPE_SECRET_KEY || null
}

// Authoritative runtime resolution for the Stripe webhook signing secret.
export async function getStripeWebhookSecret(): Promise<string | null> {
  const stored = await getStoredSecret('stripe.webhook_secret')
  if (stored) return stored
  return process.env.STRIPE_WEBHOOK_SECRET || null
}

// Returns whether a Stripe secret key is configured (stored or env).
export async function stripeSecretConfigured(): Promise<boolean> {
  if (await isStoredSecretSet('stripe.secret_key')) return true
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

// Returns whether a Stripe webhook secret is configured (stored or env).
export async function stripeWebhookSecretConfigured(): Promise<boolean> {
  if (await isStoredSecretSet('stripe.webhook_secret')) return true
  return Boolean(process.env.STRIPE_WEBHOOK_SECRET)
}

export type StripeEventMeta = {
  type: string
  label: string
  purpose: string
  /** Critical billing events can never be disabled. */
  critical: boolean
}

// Allowlist of Stripe events the application actually handles (the webhook's
// `handleStripeEvent` switch). Unknown events are never accepted.
export const SUPPORTED_STRIPE_EVENTS: StripeEventMeta[] = [
  { type: 'checkout.session.completed', label: 'Checkout Completed', purpose: 'Activates a paid subscription after checkout.', critical: true },
  { type: 'customer.subscription.updated', label: 'Subscription Updated', purpose: 'Syncs plan/status/price changes to the local subscription.', critical: true },
  { type: 'customer.subscription.deleted', label: 'Subscription Deleted', purpose: 'Marks a subscription canceled/inactive.', critical: true },
  { type: 'invoice.payment_failed', label: 'Invoice Payment Failed', purpose: 'Marks a subscription past_due.', critical: false },
  { type: 'invoice.payment_succeeded', label: 'Invoice Payment Succeeded', purpose: 'Confirms a successful recurring payment.', critical: false },
]

export const STRIPE_EVENT_TYPES = SUPPORTED_STRIPE_EVENTS.map((event) => event.type)

const EVENTS_SETTING_KEY = 'stripe.events.enabled'

// Creates a Stripe client using the authoritative resolved secret key. The
// key is resolved server-side and never returned to the client.
export async function stripeClient(): Promise<Stripe> {
  const key = await getStripeSecretKey()
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured')
  return new Stripe(key)
}

// Stripe mode is derived server-side from the resolved secret key prefix. It
// is never switchable from the browser.
export async function stripeMode(): Promise<'test' | 'live' | 'unknown'> {
  const key = (await getStripeSecretKey()) || ''
  if (key.startsWith('sk_test_')) return 'test'
  if (key.startsWith('sk_live_')) return 'live'
  return 'unknown'
}

// Reads the persisted enabled-event set (non-secret). Defaults to ALL supported
// events enabled so existing behavior is preserved until an admin changes it.
export async function getEnabledStripeEvents(): Promise<Set<string>> {
  const row = await prisma.setting.findUnique({ where: { key: EVENTS_SETTING_KEY } })
  if (!row?.value) return new Set(STRIPE_EVENT_TYPES)
  try {
    const parsed = JSON.parse(row.value)
    if (!Array.isArray(parsed)) return new Set(STRIPE_EVENT_TYPES)
    return new Set(parsed.filter((type) => typeof type === 'string'))
  } catch {
    return new Set(STRIPE_EVENT_TYPES)
  }
}

// Returns the enabled/disabled state for every supported event.
export async function getStripeEventConfig() {
  const enabled = await getEnabledStripeEvents()
  return SUPPORTED_STRIPE_EVENTS.map((event) => ({
    ...event,
    enabled: enabled.has(event.type),
  }))
}

export type StripeEventConfigUpdateResult =
  | { ok: true; config: Awaited<ReturnType<typeof getStripeEventConfig>> }
  | { ok: false; error: string }

// Server-side validation: only allowlisted event names may be toggled, and
// critical events are always enabled.
export async function updateStripeEventConfig(enabledTypes: unknown): Promise<StripeEventConfigUpdateResult> {
  if (!Array.isArray(enabledTypes)) return { ok: false, error: 'Invalid event configuration' }
  const requested = new Set(enabledTypes.filter((type): type is string => typeof type === 'string'))
  const allowlist = new Set(STRIPE_EVENT_TYPES)

  for (const type of requested) {
    if (!allowlist.has(type)) return { ok: false, error: 'Unsupported Stripe event' }
  }
  // Critical events can never be disabled.
  for (const event of SUPPORTED_STRIPE_EVENTS) {
    if (event.critical) requested.add(event.type)
  }

  await prisma.setting.upsert({
    where: { key: EVENTS_SETTING_KEY },
    update: { value: JSON.stringify([...requested]), category: 'stripe', description: 'Enabled Stripe webhook events' },
    create: { key: EVENTS_SETTING_KEY, value: JSON.stringify([...requested]), type: 'json', category: 'stripe', description: 'Enabled Stripe webhook events' },
  })

  return { ok: true, config: await getStripeEventConfig() }
}

// Safe connection test: makes a minimal Stripe API call and returns only
// safe metadata. Never returns the secret key or authorization header.
export type StripeConnectionResult =
  | { ok: true; accountId: string | null; mode: string; businessName: string | null; country: string | null; defaultCurrency: string | null; message: string }
  | { ok: false; error: string }

export async function testStripeConnection(): Promise<StripeConnectionResult> {
  if (!(await stripeSecretConfigured())) {
    return { ok: false, error: 'Stripe Secret Key is not configured' }
  }
  try {
    const stripe = await stripeClient()
    const account = await stripe.accounts.retrieve()
    const accountId = typeof account.id === 'string' ? account.id : null
    const name = (account as { business_profile?: { name?: string | null } }).business_profile?.name || null
    const country = typeof account.country === 'string' ? account.country : null
    const defaultCurrency = typeof account.default_currency === 'string' ? account.default_currency : null
    return {
      ok: true,
      accountId,
      mode: await stripeMode(),
      businessName: name,
      country,
      defaultCurrency,
      message: 'Stripe connection successful',
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Stripe connection failed' }
  }
}

// Returns the most recent Stripe webhook events for the admin log.
export async function getRecentStripeEvents(limit = 25) {
  return prisma.stripeWebhookEvent.findMany({
    orderBy: { eventCreatedAt: 'desc' },
    take: limit,
  })
}

// ---------------------------------------------------------------------------
// Admin secret management (never returns secret values)
// ---------------------------------------------------------------------------

export type SecretUpdateResult =
  | { ok: true; configured: boolean; mode: string }
  | { ok: false; error: string }

// Sets/replaces the Stripe secret key (encrypted at rest). `replace` forces a
// re-write even if a value already exists. Returns only safe metadata.
export async function setStripeSecretKey(plaintext: string, actorId: string | null, replace = false): Promise<SecretUpdateResult> {
  const normalized = plaintext.trim()
  if (!normalized) return { ok: false, error: 'Stripe Secret Key is required' }
  if (!normalized.startsWith('sk_')) return { ok: false, error: 'Invalid Stripe Secret Key format' }
  const existing = await isStoredSecretSet('stripe.secret_key')
  if (existing && !replace) return { ok: false, error: 'A Stripe Secret Key is already configured. Use Replace Secret to overwrite it.' }
  await setStoredSecret('stripe.secret_key', normalized, actorId, existing || replace ? 'REPLACE' : 'SET')
  return { ok: true, configured: true, mode: normalized.startsWith('sk_test_') ? 'test' : 'live' }
}

// Sets/replaces the Stripe webhook signing secret (encrypted at rest).
export async function setStripeWebhookSecret(plaintext: string, actorId: string | null, replace = false): Promise<SecretUpdateResult> {
  const normalized = plaintext.trim()
  if (!normalized) return { ok: false, error: 'Stripe Webhook Signing Secret is required' }
  if (!normalized.startsWith('whsec_')) return { ok: false, error: 'Invalid Stripe Webhook Signing Secret format' }
  const existing = await isStoredSecretSet('stripe.webhook_secret')
  if (existing && !replace) return { ok: false, error: 'A Webhook Signing Secret is already configured. Use Replace Secret to overwrite it.' }
  await setStoredSecret('stripe.webhook_secret', normalized, actorId, existing || replace ? 'REPLACE' : 'SET')
  return { ok: true, configured: true, mode: 'webhook' }
}

// Returns non-secret audit history for both Stripe secrets.
export async function getStripeSecretAudit() {
  const [secret, webhook] = await Promise.all([
    prisma.secureConfigAudit.findMany({ where: { configKey: 'stripe.secret_key' }, orderBy: { createdAt: 'desc' }, take: 20 }),
    prisma.secureConfigAudit.findMany({ where: { configKey: 'stripe.webhook_secret' }, orderBy: { createdAt: 'desc' }, take: 20 }),
  ])
  return {
    secretKey: secret.map((entry) => ({ action: entry.action, actorId: entry.actorId, createdAt: entry.createdAt.toISOString(), note: entry.note })),
    webhookSecret: webhook.map((entry) => ({ action: entry.action, actorId: entry.actorId, createdAt: entry.createdAt.toISOString(), note: entry.note })),
  }
}

// Verifies that a webhook signing secret is configured for signature
// verification. Non-secret boolean only.
export async function stripeWebhookSignatureVerificationConfigured(): Promise<boolean> {
  return (await getStripeWebhookSecret()) !== null
}
