import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test, { mock } from 'node:test'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const read = (relative: string): string => fs.readFileSync(path.join(ROOT, relative), 'utf8')

const companyDurable = read('lib/company-subscription-email.ts')
const brokerDurable = read('lib/broker-subscription-email.ts')
const adminEmail = read('lib/subscription-admin-email.ts')
const webhook = read('app/api/stripe/webhook/route.ts')
const brokerRegistration = read('lib/broker-registration.ts')
const registrationCheckout = read('app/api/broker-registration/subscription/checkout/route.ts')
const brokerCheckout = read('app/api/subscription/checkout/route.ts')
const companyCheckout = read('app/api/company/subscription/checkout/route.ts')
const freeRoute = read('app/api/broker-registration/subscription/free/route.ts')
const schema = read('prisma/schema.prisma')

// ===========================================================================
// F2 — Broker customer email idempotency per Stripe subscription
// ===========================================================================

test('F2: broker durable key is scoped to (brokerSubscriptionId, stripeSubscriptionId)', () => {
  assert.match(brokerDurable, /subscription_purchase_\$\{brokerSubscriptionId\}/)
  assert.match(brokerDurable, /stripeSubscriptionId \? `_\$\{stripeSubscriptionId\}`/)
  assert.match(brokerDurable, /create: \{ idempotencyKey, brokerSubscriptionId, stripeSubscriptionId: stripeSubscriptionId \|\| null, status: 'PENDING' \}/)
})

test('F2: schema stores multiple durable rows per broker subscription (per-Stripe-sub identity)', () => {
  assert.match(schema, /model BrokerSubscriptionEmailLog \{/)
  assert.match(schema, /idempotencyKey\s+String\s+@unique/)
  assert.match(schema, /brokerSubscriptionId\s+String\s+@db\.ObjectId/)
  assert.doesNotMatch(schema, /brokerSubscriptionId\s+String\s+@unique/)
  assert.match(schema, /stripeSubscriptionId\s+String\?\s+@db\.ObjectId/)
  // One-to-many inverse relation (mirrors CompanySubscription.emailLogs).
  assert.match(schema, /emailLogs BrokerSubscriptionEmailLog\[\]/)
})

test('F2: same Stripe subscription replay collapses, a new Stripe subscription is a new row', () => {
  // SENT short-circuit + atomic claim are unchanged; the key is the only
  // identity that now varies with the Stripe subscription.
  assert.match(brokerDurable, /if \(current\?\.status === 'SENT'\) return \{ status: 'skipped', reason: 'already_sent' \}/)
  assert.match(brokerDurable, /claimed\.count !== 1/)
})

// ===========================================================================
// F3 — registration checkout ownerType metadata
// ===========================================================================

test('F3: registration checkout session metadata carries ownerType=BROKER_REGISTRATION', () => {
  const sessionMeta = registrationCheckout.slice(
    registrationCheckout.indexOf('metadata: { userId: user.id, brokerRegistrationId: registrationId'),
    registrationCheckout.indexOf('subscription_data:'),
  )
  assert.match(sessionMeta, /ownerType: 'BROKER_REGISTRATION'/)
})

test('F3: registration subscription_data metadata intentionally omits ownerType', () => {
  const subData = registrationCheckout.slice(registrationCheckout.indexOf('subscription_data:'))
  const line = subData.split('\n')[0]
  assert.doesNotMatch(line, /ownerType/)
  // The registration customer metadata still carries the owner type.
  assert.match(registrationCheckout, /ownerType: 'BROKER_REGISTRATION'/)
})

test('F3: existing broker checkout remains ownerType=BROKER and company remains COMPANY', () => {
  assert.match(brokerCheckout, /ownerType: 'BROKER'/)
  assert.match(companyCheckout, /ownerType: 'COMPANY'/)
})

test('F3: registration stale-checkout reconciliation is reachable via session ownerType', () => {
  assert.match(webhook, /ownerType === 'BROKER_REGISTRATION'/)
  assert.match(webhook, /reconcileBrokerRegistrationCheckoutExpired/)
  assert.match(registrationCheckout, /ownerType: 'BROKER_REGISTRATION'/)
})

// ===========================================================================
// F1 / F5 — broker email reliability across ordering (registration + webhook)
// ===========================================================================

test('F1: finalizeBrokerRegistration dispatches the broker durable email after commit', () => {
  assert.match(brokerRegistration, /sendBrokerSubscriptionPurchaseEmailDurable/)
  assert.match(brokerRegistration, /createdBrokerId/)
  assert.match(brokerRegistration, /dispatchBrokerRegistrationActivationEmail/)
  // Only a fresh FEATURED+stripeSubId subscription dispatches (FREE/no-Stripe never).
  assert.match(brokerRegistration, /subscription\?\.isActive && subscription\.plan === 'FEATURED' && subscription\.stripeSubId/)
})

test('F5: webhook dispatches the broker activation email from every activating event', () => {
  assert.match(webhook, /function dispatchBrokerActivationEmail/)
  assert.match(webhook, /if \(!\('brokerId' in updated\)\) return/)
  const calls = (webhook.match(/dispatchBrokerActivationEmail\(updated/g) || []).length
  assert.ok(calls >= 3, 'checkout.session.completed + customer.subscription.updated + invoice.payment_succeeded')
  assert.match(webhook, /case 'checkout\.session\.completed'/)
  assert.match(webhook, /case 'customer\.subscription\.updated'/)
  assert.match(webhook, /case 'invoice\.payment_failed':/)
})

test('F1/F5: broker activation email is idempotent per Stripe subscription at the durable layer', () => {
  assert.match(brokerDurable, /idempotencyKey/)
  assert.match(brokerDurable, /status: 'SENT'/)
  assert.match(brokerDurable, /claimEligibleWhere/)
})

// ===========================================================================
// F4 — admin subscription-payment notification
// ===========================================================================

test('F4: admin module uses platformConfig.adminEmails, the generic template, and the shared sendEmail boundary', () => {
  assert.match(adminEmail, /platformConfig\.adminEmails/)
  assert.match(adminEmail, /emailTemplates\.notification/)
  assert.match(adminEmail, /sendEmail\(/)
  assert.match(adminEmail, /if \(platformConfig\.adminEmails\.length === 0\)/)
  assert.match(adminEmail, /to: platformConfig\.adminEmails/)
})

test('F4: admin module distinguishes Company vs Broker and never references customer-only data', () => {
  assert.match(adminEmail, /'COMPANY_ADVERTISING'/)
  assert.match(adminEmail, /'BROKER_FEATURED'/)
  assert.match(adminEmail, /Company advertising/)
  assert.match(adminEmail, /Mortgage Expert/)
  assert.doesNotMatch(adminEmail, /cvv|cvc|whsec_|sk_live_|sk_test_|client_secret|card number/i)
})

test('F4: both durable senders dispatch the admin notification from inside the durable claim', () => {
  assert.match(companyDurable, /sendSubscriptionAdminPaymentNotification/)
  assert.match(brokerDurable, /sendSubscriptionAdminPaymentNotification/)
  assert.match(companyDurable, /product: 'COMPANY_ADVERTISING'/)
  assert.match(brokerDurable, /product: 'BROKER_FEATURED'/)
})

test('F4: admin notification is skipped for FREE (no stripeSubscriptionId, no durable sender call)', () => {
  assert.match(freeRoute, /plan: 'FREE', status: 'ACTIVE'/)
  assert.doesNotMatch(freeRoute, /sendEmail|sendSubscriptionAdminPaymentNotification|stripe\.checkout/)
  assert.match(brokerRegistration, /subscription\.plan === 'FEATURED' && subscription\.stripeSubId/)
})

// ===========================================================================
// Runtime — admin notification delivery + idempotency identity
// ===========================================================================

type SentEmail = { to: string | string[]; subject: string; idempotencyKey?: string; html: string }
const sent: SentEmail[] = []
const platformConfigMock: { adminEmails: string[]; appUrl: string } = {
  adminEmails: ['ops-one@example.com', 'ops-two@example.com'],
  appUrl: 'https://example.com',
}

mock.module('@/lib/platform-config', {
  exports: { platformConfig: platformConfigMock },
} as never)

mock.module('@/lib/email', {
  exports: {
    sendEmail: async (args: SentEmail) => {
      sent.push(args)
      return { success: true, messageId: 'msg_test_1' }
    },
    emailTemplates: {
      notification: (data: { title: string; message: string; info: Record<string, string> }) => ({
        subject: data.title,
        preheader: data.message,
        html: `${data.message}\n${JSON.stringify(data.info)}`,
      }),
    },
  },
} as never)

test('F4 runtime: notifies every configured admin with a deterministic per-subscription key', async () => {
  sent.length = 0
  platformConfigMock.adminEmails = ['ops-one@example.com', 'ops-two@example.com']
  const { sendSubscriptionAdminPaymentNotification } = await import('../lib/subscription-admin-email')

  const result = await sendSubscriptionAdminPaymentNotification({
    product: 'COMPANY_ADVERTISING',
    localSubscriptionId: 'cs-1',
    stripeSubscriptionId: 'sub_company_A',
    planName: 'ADVERTISING',
    priceCents: 500,
    currency: 'usd',
    interval: 'month',
    customerName: 'Acme Holdings',
    customerEmail: 'owner@example.com',
  })

  assert.deepEqual(result, { status: 'sent' })
  assert.equal(sent.length, 1)
  assert.deepEqual(sent[0].to, ['ops-one@example.com', 'ops-two@example.com'])
  assert.match(sent[0].subject, /Company advertising/)
  assert.equal(sent[0].idempotencyKey, 'admin_subscription_payment_COMPANY_ADVERTISING_cs-1_sub_company_A')
})

test('F4 runtime: broker notification is distinguishable and per-Stripe-subscription keyed', async () => {
  sent.length = 0
  const { sendSubscriptionAdminPaymentNotification } = await import('../lib/subscription-admin-email')
  await sendSubscriptionAdminPaymentNotification({
    product: 'BROKER_FEATURED',
    localSubscriptionId: 'bsub-1',
    stripeSubscriptionId: 'sub_broker_B',
    planName: 'Mortgage Expert',
    priceCents: 1500,
    currency: 'usd',
    interval: 'month',
    customerName: 'Jane Originator',
    customerEmail: 'jane@example.com',
  })
  assert.equal(sent.length, 1)
  assert.match(sent[0].subject, /Broker FEATURED/)
  assert.equal(sent[0].idempotencyKey, 'admin_subscription_payment_BROKER_FEATURED_bsub-1_sub_broker_B')
})

test('F4 runtime: no configured admin recipients -> skipped, no email sent', async () => {
  sent.length = 0
  platformConfigMock.adminEmails = []
  const { sendSubscriptionAdminPaymentNotification } = await import('../lib/subscription-admin-email')
  const result = await sendSubscriptionAdminPaymentNotification({
    product: 'COMPANY_ADVERTISING',
    localSubscriptionId: 'cs-2',
    stripeSubscriptionId: 'sub_company_C',
    planName: 'ADVERTISING',
    priceCents: 500,
    customerName: 'No Admins Co',
  })
  assert.deepEqual(result, { status: 'skipped', reason: 'no_admin_recipients' })
  assert.equal(sent.length, 0)
})

test('F4 runtime: a new Stripe subscription yields a different idempotency key', async () => {
  sent.length = 0
  platformConfigMock.adminEmails = ['ops-one@example.com']
  const { sendSubscriptionAdminPaymentNotification } = await import('../lib/subscription-admin-email')
  const base = {
    product: 'COMPANY_ADVERTISING' as const,
    localSubscriptionId: 'cs-3',
    planName: 'ADVERTISING',
    priceCents: 500,
    customerName: 'Acme Holdings',
  }
  await sendSubscriptionAdminPaymentNotification({ ...base, stripeSubscriptionId: 'sub_X' })
  await sendSubscriptionAdminPaymentNotification({ ...base, stripeSubscriptionId: 'sub_Y' })
  assert.equal(sent.length, 2)
  assert.notEqual(sent[0].idempotencyKey, sent[1].idempotencyKey)
})

// ===========================================================================
// Cross-product isolation
// ===========================================================================

test('cross-product: broker and company durable senders never mix products or recipients', () => {
  assert.doesNotMatch(brokerDurable, /companySubscription|CompanySubscription/)
  assert.doesNotMatch(companyDurable, /brokerSubscription|BrokerSubscription/)
  assert.doesNotMatch(adminEmail, /brokerSubscriptionEmailLog|companySubscriptionEmailLog/)
})
