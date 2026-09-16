/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from 'node:assert/strict'
import test, { mock } from 'node:test'

// ===========================================================================
// PHASE 8.43 runtime — customer activation email + admin payment notification
// idempotency through the REAL durable senders (Prisma + Resend mocked).
// ===========================================================================

type EmailLogRow = {
  id: string
  idempotencyKey: string
  brokerSubscriptionId?: string
  companySubscriptionId?: string
  stripeSubscriptionId?: string | null
  status: string
  attempts: number
  leaseExpiresAt: Date | null
  claimedAt: Date | null
  sentAt: Date | null
  messageId: string | null
  lastError: string | null
}

const store = {
  brokerLogs: [] as EmailLogRow[],
  companyLogs: [] as EmailLogRow[],
  brokerSubs: [] as Array<Record<string, unknown>>,
  companySubs: [] as Array<Record<string, unknown>>,
}

const emailCalls: Array<{ to: string | string[]; subject: string; idempotencyKey?: string }> = []
const platformConfigMock: { adminEmails: string[]; appUrl: string } = {
  adminEmails: ['ops@example.com'],
  appUrl: 'https://example.com',
}

function reset() {
  store.brokerLogs = []
  store.companyLogs = []
  store.brokerSubs = []
  store.companySubs = []
  emailCalls.length = 0
  platformConfigMock.adminEmails = ['ops@example.com']
}

function primeBroker() {
  store.brokerSubs = [{
    id: 'bsub-1',
    plan: 'FEATURED',
    isActive: true,
    startDate: new Date('2026-01-01'),
    endDate: null,
    broker: { id: 'broker-1', displayName: 'Jane Originator', email: 'jane@example.com', user: { email: 'jane@example.com' } },
    planRef: { name: 'Mortgage Expert', price: 1500, currency: 'usd', billingInterval: 'month' },
  }]
}

function primeCompany() {
  store.companySubs = [{
    id: 'cs-1',
    plan: 'ADVERTISING',
    isActive: true,
    startDate: new Date('2026-01-01'),
    endDate: null,
    company: {
      id: 'company-1',
      name: 'Acme Holdings',
      memberships: [{ role: 'OWNER', isActive: true, user: { email: 'owner@example.com' } }],
    },
    advertisingPlan: { name: 'ADVERTISING', price: 500, currency: 'usd', billingInterval: 'month' },
  }]
}

function emailLogModel(rows: () => EmailLogRow[]) {
  return {
    upsert: async ({ where, create }: { where: { idempotencyKey: string }; create: Partial<EmailLogRow> }) => {
      const existing = rows().find((r) => r.idempotencyKey === where.idempotencyKey)
      if (existing) return existing
      const row = { id: `log-${rows().length + 1}`, status: 'PENDING', attempts: 0, leaseExpiresAt: null, claimedAt: null, sentAt: null, messageId: null, lastError: null, ...create } as EmailLogRow
      rows().push(row)
      return row
    },
    findUnique: async ({ where }: { where: { idempotencyKey: string } }) =>
      rows().find((r) => r.idempotencyKey === where.idempotencyKey) || null,
    updateMany: async ({ where, data }: { where: any; data: any }) => {
      const row = rows().find((r) => r.idempotencyKey === where.idempotencyKey)
      if (!row) return { count: 0 }
      const claimable = (where.OR as any[]).some((cond: any) => {
        if (Array.isArray(cond.status?.in)) return (cond.status.in as string[]).includes(row.status)
        if (cond.status === 'PROCESSING') {
          return Boolean(row.leaseExpiresAt && row.status === 'PROCESSING' && new Date(row.leaseExpiresAt) <= new Date(cond.leaseExpiresAt.lte))
        }
        return false
      })
      if (!claimable) return { count: 0 }
      const { attempts, ...rest } = data
      if (attempts?.increment) row.attempts += attempts.increment
      Object.assign(row, rest)
      return { count: 1 }
    },
    update: async ({ where, data }: { where: { idempotencyKey: string }; data: any }) => {
      const row = rows().find((r) => r.idempotencyKey === where.idempotencyKey)
      if (!row) throw new Error('email log row not found')
      Object.assign(row, data)
      return row
    },
  }
}

const fakePrisma = {
  brokerSubscriptionEmailLog: emailLogModel(() => store.brokerLogs),
  companySubscriptionEmailLog: emailLogModel(() => store.companyLogs),
  brokerSubscription: {
    findUnique: async ({ where }: { where: { id: string } }) => store.brokerSubs.find((s) => s.id === where.id) || null,
  },
  companySubscription: {
    findUnique: async ({ where }: { where: { id: string } }) => store.companySubs.find((s) => s.id === where.id) || null,
  },
}

mock.module('@/lib/prisma', { exports: { default: fakePrisma } } as never)
mock.module('@/lib/platform-config', { exports: { platformConfig: platformConfigMock } } as never)
mock.module('@/lib/email', {
  exports: {
    sendEmail: async (args: { to: string | string[]; subject: string; idempotencyKey?: string }) => {
      emailCalls.push(args)
      return { success: true, messageId: `msg-${emailCalls.length}` }
    },
    emailTemplates: {
      subscriptionPurchased: (d: { brokerName: string; planName: string }) => ({ subject: `${d.planName} subscription is active`, preheader: '', html: d.brokerName }),
      companySubscriptionPurchased: (d: { companyName: string; planName: string }) => ({ subject: `${d.planName} subscription is active`, preheader: '', html: d.companyName }),
      notification: (d: { title: string; message: string }) => ({ subject: d.title, preheader: d.message, html: d.message }),
    },
  },
} as never)

const loadBrokerSender = () => import('../lib/broker-subscription-email')
const loadCompanySender = () => import('../lib/company-subscription-email')

test('broker: one activation sends exactly one customer email AND one admin email', async () => {
  reset()
  primeBroker()
  const { sendBrokerSubscriptionPurchaseEmailDurable } = await loadBrokerSender()

  const first = await sendBrokerSubscriptionPurchaseEmailDurable('bsub-1', 'sub_A')
  assert.deepEqual(first, { status: 'sent' })
  assert.equal(emailCalls.length, 2)
  const customer = emailCalls.find((c) => c.to === 'jane@example.com')
  const admin = emailCalls.find((c) => Array.isArray(c.to) && (c.to as string[]).includes('ops@example.com'))
  assert.ok(customer, 'customer email sent to the broker')
  assert.ok(admin, 'admin notification sent to configured admins')
  assert.equal(store.brokerLogs.length, 1)
  assert.equal(store.brokerLogs[0].status, 'SENT')
  assert.equal(store.brokerLogs[0].stripeSubscriptionId, 'sub_A')
})

test('broker: replay of the same Stripe subscription sends nothing', async () => {
  reset()
  primeBroker()
  const { sendBrokerSubscriptionPurchaseEmailDurable } = await loadBrokerSender()
  await sendBrokerSubscriptionPurchaseEmailDurable('bsub-1', 'sub_A')
  emailCalls.length = 0

  const replay = await sendBrokerSubscriptionPurchaseEmailDurable('bsub-1', 'sub_A')
  assert.deepEqual(replay, { status: 'skipped', reason: 'already_sent' })
  assert.equal(emailCalls.length, 0, 'no duplicate customer or admin email')
  assert.equal(store.brokerLogs.length, 1)
})

test('broker: a NEW Stripe subscription sends a new customer + admin email', async () => {
  reset()
  primeBroker()
  const { sendBrokerSubscriptionPurchaseEmailDurable } = await loadBrokerSender()
  await sendBrokerSubscriptionPurchaseEmailDurable('bsub-1', 'sub_A')
  emailCalls.length = 0

  const resub = await sendBrokerSubscriptionPurchaseEmailDurable('bsub-1', 'sub_B')
  assert.deepEqual(resub, { status: 'sent' })
  assert.equal(emailCalls.length, 2, 'new customer + new admin email')
  assert.equal(store.brokerLogs.length, 2, 'independent durable row per Stripe subscription')
  const keys = store.brokerLogs.map((l) => l.idempotencyKey).sort()
  assert.deepEqual(keys, ['subscription_purchase_bsub-1_sub_A', 'subscription_purchase_bsub-1_sub_B'])
})

test('broker: FREE / no stripe subscription never dispatches the paid email', async () => {
  reset()
  primeBroker()
  store.brokerSubs[0].plan = 'FREE'
  store.brokerSubs[0].planRef = { name: 'Free', price: 0, currency: 'usd', billingInterval: 'month' }
  const { sendBrokerSubscriptionPurchaseEmailDurable } = await loadBrokerSender()
  // The registration dispatcher only calls the sender for FEATURED+stripeSubId,
  // but even a direct defensive call without a Stripe sub must not notify admins.
  const res = await sendBrokerSubscriptionPurchaseEmailDurable('bsub-1', null)
  assert.equal(res.status, 'sent')
  assert.equal(emailCalls.filter((c) => Array.isArray(c.to)).length, 0, 'no admin notification without a Stripe subscription')
})

test('company: one activation sends one customer email AND one admin email; replay is silent', async () => {
  reset()
  primeCompany()
  const { sendCompanySubscriptionPurchaseEmailDurable } = await loadCompanySender()

  const first = await sendCompanySubscriptionPurchaseEmailDurable('cs-1', 'sub_A')
  assert.deepEqual(first, { status: 'sent' })
  assert.equal(emailCalls.length, 2)
  assert.ok(emailCalls.some((c) => c.to === 'owner@example.com'), 'customer email to owner')
  assert.ok(emailCalls.some((c) => Array.isArray(c.to) && (c.to as string[]).includes('ops@example.com')), 'admin notification')
  assert.equal(store.companyLogs[0].status, 'SENT')

  emailCalls.length = 0
  const replay = await sendCompanySubscriptionPurchaseEmailDurable('cs-1', 'sub_A')
  assert.deepEqual(replay, { status: 'skipped', reason: 'already_sent' })
  assert.equal(emailCalls.length, 0)
})

test('company: a new Stripe subscription produces a new durable row and emails', async () => {
  reset()
  primeCompany()
  const { sendCompanySubscriptionPurchaseEmailDurable } = await loadCompanySender()
  await sendCompanySubscriptionPurchaseEmailDurable('cs-1', 'sub_A')
  emailCalls.length = 0
  await sendCompanySubscriptionPurchaseEmailDurable('cs-1', 'sub_B')
  assert.equal(emailCalls.length, 2)
  assert.equal(store.companyLogs.length, 2)
})

test('admin: no configured recipients -> customer email still sent, no admin send', async () => {
  reset()
  primeCompany()
  platformConfigMock.adminEmails = []
  const { sendCompanySubscriptionPurchaseEmailDurable } = await loadCompanySender()
  const res = await sendCompanySubscriptionPurchaseEmailDurable('cs-1', 'sub_A')
  assert.equal(res.status, 'sent')
  assert.equal(emailCalls.length, 1, 'only the customer email')
  assert.equal(emailCalls[0].to, 'owner@example.com')
})

test('isolation: broker activation never sends a company email or vice versa', async () => {
  reset()
  primeBroker()
  primeCompany()
  const { sendBrokerSubscriptionPurchaseEmailDurable } = await loadBrokerSender()
  const { sendCompanySubscriptionPurchaseEmailDurable } = await loadCompanySender()

  await sendBrokerSubscriptionPurchaseEmailDurable('bsub-1', 'sub_A')
  assert.ok(emailCalls.some((c) => c.to === 'jane@example.com'))
  assert.ok(!emailCalls.some((c) => c.to === 'owner@example.com'))
  assert.ok(emailCalls.some((c) => c.idempotencyKey?.startsWith('admin_subscription_payment_BROKER_FEATURED_')))

  emailCalls.length = 0
  await sendCompanySubscriptionPurchaseEmailDurable('cs-1', 'sub_A')
  assert.ok(emailCalls.some((c) => c.to === 'owner@example.com'))
  assert.ok(!emailCalls.some((c) => c.to === 'jane@example.com'))
  assert.ok(emailCalls.some((c) => c.idempotencyKey?.startsWith('admin_subscription_payment_COMPANY_ADVERTISING_')))
})
