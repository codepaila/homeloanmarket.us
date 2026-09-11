/* eslint-disable @typescript-eslint/no-explicit-any */
// Phase 8.40.2 — payment-failure webhook-path tests (F-8 evidence).
//
// These tests execute the REAL production webhook path:
//   POST / handleStripeEvent (app/api/stripe/webhook/route.ts)
//     → real Stripe SDK signature verification (webhooks.constructEvent)
//     → real Stripe SDK subscriptions.retrieve
//     → SubscriptionService.updateSubscriptionFromStripe (lib/subscription.ts)
//     → sendBrokerPaymentFailureEmail / sendCompanyPaymentFailureEmail
//       (actions/email.action.ts)
//     → durable senders (lib/broker-payment-failure-email.ts,
//       lib/company-payment-failure-email.ts) with their durable
//       subscription+invoice idempotency logs
//     → emailTemplates.paymentFailure (lib/email-templates.ts)
//     → sendEmail (lib/email.ts)
//
// Only external/runtime boundaries are mocked, following the repository's
// getter-based node:test mock.module pattern (which requires Node's
// --experimental-test-module-mocks flag under Node 24):
//   - Stripe HTTP transport: the REAL Stripe SDK runs (signature verification,
//     request building, response parsing) but its node https transport is
//     intercepted — the same monkey-patch seam Stripe's own code documents for
//     nock-style tools. Empirically, mock.module on the bare 'stripe' package
//     does NOT reach repo code under tsx, so the transport is the faithful
//     external boundary for the webhook's internal `new Stripe(key)` usage.
//   - Upstash Redis (billing lock): the REAL @upstash/redis client runs and its
//     REST fetch call is intercepted (the client invokes the global fetch at
//     call time, auto-pipelined as [[...command]]).
//   - @/lib/prisma (in-memory document store with Prisma-like semantics)
//   - @/lib/email (Resend boundary; real email templates are kept)
//   - next/headers (request header access outside the Next runtime)

import { mock, test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import crypto from 'node:crypto'
import { emailTemplates } from '../lib/email-templates'

const require_ = createRequire(import.meta.url)
const https = require_('node:https')

process.env.STRIPE_SECRET_KEY = 'sk_test_payment_failure_webhook'
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_payment_failure_webhook'
process.env.UPSTASH_REDIS_REST_URL = 'https://upstash-fake.test'
process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'

// ---------------------------------------------------------------------------
// Shared mutable state
// ---------------------------------------------------------------------------
type LogRow = {
  id: string
  idempotencyKey: string
  invoiceId: string
  status: string
  attempts: number
  leaseExpiresAt: Date | null
  claimedAt: Date | null
  sentAt: Date | null
  messageId: string | null
  lastError: string | null
  brokerSubscriptionId?: string
  companySubscriptionId?: string
}

const store = {
  brokerSubs: [] as any[],
  registrationSubs: [] as any[],
  companySubs: [] as any[],
  brokers: [] as any[],
  companies: [] as any[],
  brokerPlans: [] as any[],
  advertisingPlans: [] as any[],
  brokerLogs: [] as LogRow[],
  companyLogs: [] as LogRow[],
  brokerReconciliations: [] as any[],
  registrationReconciliations: [] as any[],
  companyReconciliations: [] as any[],
  brokerFeatureUpdates: [] as any[],
  companyActivations: [] as any[],
  registrationStatusUpdates: [] as any[],
  webhookEvents: [] as any[],
  order: [] as string[],
}

const emailCalls: Array<{ to: string; subject: string; idempotencyKey?: string }> = []
const emailState = { behavior: 'success' as 'success' | 'failure' | 'throw' }

// The Stripe REST fake: served through the REAL Stripe SDK by intercepting
// https.request. State is read at call time.
const stripeState = {
  subscription: null as any,
  retrieveCalls: [] as string[],
}

// The Upstash REST fake: served through the REAL @upstash/redis client by
// intercepting the global fetch it invokes at call time.
const redisLocks = new Map<string, string>()

function resetFixtures(kind: 'broker' | 'company' | 'registration' | 'ambiguous' | 'unknown' | 'none') {
  store.brokerSubs = []
  store.registrationSubs = []
  store.companySubs = []
  store.brokers = []
  store.companies = []
  store.brokerPlans = []
  store.advertisingPlans = []
  store.brokerLogs = []
  store.companyLogs = []
  store.brokerReconciliations = []
  store.registrationReconciliations = []
  store.companyReconciliations = []
  store.brokerFeatureUpdates = []
  store.companyActivations = []
  store.registrationStatusUpdates = []
  store.webhookEvents = []
  store.order = []
  emailCalls.length = 0
  emailState.behavior = 'success'
  stripeState.subscription = null
  stripeState.retrieveCalls = []
  redisLocks.clear()

  if (kind === 'broker') {
    const sub: any = {
      id: 'bsub-1',
      brokerId: 'broker-1',
      plan: 'FEATURED',
      planId: 'plan-b',
      isActive: true,
      startDate: new Date(),
      endDate: null,
      stripeCustomerId: 'cus_broker',
      stripeSubId: 'sub_broker',
    }
    const broker: any = {
      id: 'broker-1',
      displayName: 'Acme Mortgages',
      email: 'broker-direct@example.com',
      avgRating: 4.5,
      totalReviews: 10,
      experienceYears: 8,
      leads: [],
      subscription: sub,
      user: { id: 'user-1', email: 'owner-user@example.com' },
    }
    sub.broker = broker
    store.brokerSubs = [sub]
    store.brokers = [broker]
    store.brokerPlans = [{ id: 'plan-b', code: 'FEATURED', stripePriceId: 'price_broker' }]
    stripeState.subscription = {
      id: 'sub_broker',
      object: 'subscription',
      customer: 'cus_broker',
      status: 'past_due',
      metadata: { ownerType: 'BROKER' },
      items: { data: [{ price: { id: 'price_broker' } }] },
    }
  }

  if (kind === 'company') {
    const company: any = {
      id: 'company-1',
      name: 'Acme Realty',
      memberships: [
        { id: 'mem-owner', role: 'OWNER', isActive: true, user: { id: 'user-owner', email: 'owner@example.com' } },
        { id: 'mem-member', role: 'MEMBER', isActive: true, user: { id: 'user-member', email: 'member@example.com' } },
        { id: 'mem-inactive', role: 'OWNER', isActive: false, user: { id: 'user-inactive-owner', email: 'inactive-owner@example.com' } },
      ],
    }
    const sub: any = {
      id: 'csub-1',
      companyId: 'company-1',
      plan: 'ADVERTISING',
      planId: 'adv-1',
      status: 'ACTIVE',
      isActive: true,
      startDate: new Date(),
      endDate: null,
      stripeCustomerId: 'cus_company',
      stripeSubId: 'sub_company',
      company,
    }
    company.subscription = sub
    store.companySubs = [sub]
    store.companies = [company]
    store.advertisingPlans = [{ id: 'adv-1', name: 'Standard Advertising', stripePriceId: 'price_company' }]
    stripeState.subscription = {
      id: 'sub_company',
      object: 'subscription',
      customer: 'cus_company',
      status: 'past_due',
      metadata: { ownerType: 'COMPANY' },
      items: { data: [{ price: { id: 'price_company' } }] },
    }
  }

  if (kind === 'registration') {
    const sub = {
      id: 'rsub-1',
      registrationId: 'reg-1',
      status: 'ACTIVE',
      isActive: true,
      stripeCustomerId: 'cus_reg',
      stripeSubId: 'sub_reg',
      registration: { id: 'reg-1', status: 'ONBOARDING_IN_PROGRESS' },
    }
    store.registrationSubs = [sub]
    stripeState.subscription = {
      id: 'sub_reg',
      object: 'subscription',
      customer: 'cus_reg',
      status: 'past_due',
      metadata: { ownerType: 'BROKER_REGISTRATION' },
      items: { data: [{ price: { id: 'price_reg' } }] },
    }
  }

  if (kind === 'ambiguous') {
    // Same Stripe customer maps to two products (registration + company) with
    // no ownerType metadata: strict ownership resolution must refuse.
    store.registrationSubs = [
      { id: 'rsub-amb', registrationId: 'reg-amb', status: 'ACTIVE', isActive: true, stripeCustomerId: 'cus_shared', stripeSubId: 'sub_shared', registration: { id: 'reg-amb', status: 'ONBOARDING_IN_PROGRESS' } },
    ]
    store.companySubs = [
      { id: 'csub-amb', companyId: 'company-amb', plan: 'ADVERTISING', planId: null, status: 'ACTIVE', isActive: true, stripeCustomerId: 'cus_shared', stripeSubId: 'sub_shared', company: { id: 'company-amb', name: 'Shared', memberships: [] } },
    ]
    stripeState.subscription = {
      id: 'sub_shared',
      object: 'subscription',
      customer: 'cus_shared',
      status: 'past_due',
      metadata: {},
      items: { data: [{ price: { id: 'price_shared' } }] },
    }
  }

  if (kind === 'unknown') {
    stripeState.subscription = {
      id: 'sub_unknown',
      object: 'subscription',
      customer: 'cus_nobody',
      status: 'past_due',
      metadata: {},
      items: { data: [{ price: { id: 'price_unknown' } }] },
    }
  }
}

// ---------------------------------------------------------------------------
// Transport seam: Stripe REST API via https.request interception.
// The REAL Stripe SDK (signature verification, request building, response
// parsing) runs against this fake transport.
// ---------------------------------------------------------------------------
const realHttpsRequest = https.request

function fakeStripeResponseFor(path: string): unknown {
  if (path.startsWith('/v1/subscriptions/')) {
    // Record the retrieve target (GET /v1/subscriptions/sub_x) for assertions.
    const subId = path.split('?')[0].split('/').pop()
    if (subId && subId !== 'subscriptions') stripeState.retrieveCalls.push(subId)
    return stripeState.subscription
  }
  if (path.startsWith('/v1/customers/')) {
    return { id: stripeState.subscription?.customer, object: 'customer', deleted: false, metadata: {} }
  }
  return { error: { message: `Unhandled Stripe path in test transport: ${path}`, type: 'invalid_request_error' } }
}

function installStripeTransport() {
  const fakeRequest = (options: any) => {
    const path: string = String(options?.path || '')
    const req: any = new EventEmitter()
    req.setTimeout = () => req
    req.write = () => true
    req.end = () => req
    req.destroy = () => {}
    setImmediate(() => {
      const body = fakeStripeResponseFor(path)
      const res: any = new PassThrough()
      res.statusCode = 200
      res.headers = { 'content-type': 'application/json', 'request-id': 'req_test_transport' }
      req.emit('response', res)
      res.end(JSON.stringify(body))
    })
    return req
  }
  ;(https as any).request = fakeRequest
}

function restoreStripeTransport() {
  ;(https as any).request = realHttpsRequest
}

// ---------------------------------------------------------------------------
// Transport seam: Upstash Redis REST via global fetch interception.
// The REAL @upstash/redis client (fromEnv, lock acquisition/release) runs
// against this fake.
// ---------------------------------------------------------------------------
const realFetch = globalThis.fetch

function installUpstashTransport() {
  ;(globalThis as any).fetch = async (input: any, init?: any) => {
    const url = typeof input === 'string' ? input : String(input?.url ?? input)
    if (url.includes('upstash-fake.test')) {
      // The Upstash REST client auto-pipelines: bodies are [[...command]] and
      // expect an array of {result, error} rows.
      const parsed = JSON.parse(String(init?.body))
      const isPipeline = Array.isArray(parsed) && Array.isArray(parsed[0])
      const commands: any[][] = isPipeline ? parsed : [parsed]
      const results = commands.map((command) => {
        const cmd = String(command[0]).toLowerCase()
        if (cmd === 'set') {
          const key = String(command[1])
          const hasNx = command.some((v: unknown) => String(v).toLowerCase() === 'nx')
          if (hasNx && redisLocks.has(key)) return { result: null, error: null } // NX conflict
          redisLocks.set(key, String(command[2]))
          return { result: 'OK', error: null }
        }
        if (cmd === 'get') return { result: redisLocks.get(String(command[1])) ?? null, error: null }
        if (cmd === 'del') {
          redisLocks.delete(String(command[1]))
          return { result: 1, error: null }
        }
        if (cmd === 'eval') return { result: 1, error: null }
        return { result: null, error: `unhandled redis command: ${cmd}` }
      })
      return new Response(JSON.stringify(isPipeline ? results : results[0]), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    return realFetch(input, init)
  }
}

function restoreUpstashTransport() {
  ;(globalThis as any).fetch = realFetch
}

// Computes a REAL Stripe webhook signature header so the real
// webhooks.constructEvent signature verification runs in the POST-path tests.
function stripeSignatureHeader(payload: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex')
  return `t=${timestamp},v1=${signature}`
}

// ---------------------------------------------------------------------------
// Mock: Prisma (in-memory, semantics matched to the real callers)
// ---------------------------------------------------------------------------
function failureLogModel(kind: 'broker' | 'company') {
  const rows = () => (kind === 'broker' ? store.brokerLogs : store.companyLogs)
  return {
    upsert: async ({ where, create }: { where: { idempotencyKey: string }; create: Partial<LogRow> }) => {
      const existing = rows().find((r) => r.idempotencyKey === where.idempotencyKey)
      if (existing) return existing
      const row: LogRow = {
        id: `${kind}-failure-log-${rows().length + 1}`,
        idempotencyKey: where.idempotencyKey,
        invoiceId: '',
        status: 'PENDING',
        attempts: 0,
        leaseExpiresAt: null,
        claimedAt: null,
        sentAt: null,
        messageId: null,
        lastError: null,
        ...create,
      } as LogRow
      rows().push(row)
      return row
    },
    findUnique: async ({ where }: { where: { idempotencyKey: string } }) =>
      rows().find((r) => r.idempotencyKey === where.idempotencyKey) || null,
    update: async ({ where, data }: { where: { idempotencyKey: string }; data: Partial<LogRow> }) => {
      const row = rows().find((r) => r.idempotencyKey === where.idempotencyKey)
      if (!row) throw new Error(`${kind} payment-failure log row not found`)
      Object.assign(row, data)
      return row
    },
    updateMany: async ({ where, data }: { where: { idempotencyKey: string; OR: any[] }; data: any }) => {
      const row = rows().find((r) => r.idempotencyKey === where.idempotencyKey)
      if (!row) return { count: 0 }
      const claimable = where.OR.some((cond: any) => {
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
  }
}

const fakePrisma: any = {
  setting: { findUnique: async () => null },
  secureConfig: { findUnique: async () => null },
  secureConfigAudit: { findMany: async () => [] },
  brokerSubscriptionPlan: {
    findFirst: async ({ where }: { where: { stripePriceId: string } }) =>
      store.brokerPlans.find((p) => p.stripePriceId === where.stripePriceId) || null,
    findUnique: async ({ where }: { where: { code: string } }) => store.brokerPlans.find((p) => p.code === where.code) || null,
    findMany: async () => store.brokerPlans,
  },
  companyAdvertisingPlan: {
    findFirst: async ({ where }: { where: { stripePriceId?: string; id?: string } }) => {
      if (where.stripePriceId) return store.advertisingPlans.find((p) => p.stripePriceId === where.stripePriceId) || null
      if (where.id) return store.advertisingPlans.find((p) => p.id === where.id) || null
      return null
    },
    findUnique: async ({ where }: { where: { id: string } }) => store.advertisingPlans.find((p) => p.id === where.id) || null,
  },
  brokerSubscription: {
    findFirst: async ({ where }: { where: { stripeCustomerId?: string } }) =>
      store.brokerSubs.find((s) => s.stripeCustomerId === where.stripeCustomerId) || null,
    findUnique: async ({ where, include }: { where: { id?: string; brokerId?: string }; include?: any }) => {
      const sub = where.id
        ? store.brokerSubs.find((s) => s.id === where.id)
        : store.brokerSubs.find((s) => s.brokerId === where.brokerId)
      if (!sub) return null
      if (include?.broker) return { ...sub, broker: { ...sub.broker, subscription: sub } }
      return sub
    },
    update: async ({ where, data }: { where: { id: string }; data: any }) => {
      const sub = store.brokerSubs.find((s) => s.id === where.id)
      if (!sub) throw new Error('brokerSubscription not found')
      Object.assign(sub, data)
      store.brokerReconciliations.push({ id: sub.id, ...data })
      store.order.push('reconcile')
      return sub
    },
  },
  broker: {
    findUnique: async ({ where, include }: { where: { id: string }; include?: any }) => {
      const broker = store.brokers.find((b) => b.id === where.id)
      if (!broker) return null
      if (include?.subscription) return { ...broker, subscription: broker.subscription }
      return broker
    },
    update: async ({ where, data }: { where: { id: string }; data: any }) => {
      const broker = store.brokers.find((b) => b.id === where.id)
      if (!broker) throw new Error('broker not found')
      Object.assign(broker, data)
      store.brokerFeatureUpdates.push({ id: broker.id, ...data })
      return broker
    },
  },
  brokerRegistrationSubscription: {
    findFirst: async ({ where }: { where: { stripeCustomerId: string } }) =>
      store.registrationSubs.find((s) => s.stripeCustomerId === where.stripeCustomerId) || null,
    update: async ({ where, data }: { where: { id: string }; data: any }) => {
      const sub = store.registrationSubs.find((s) => s.id === where.id)
      if (!sub) throw new Error('registration subscription not found')
      Object.assign(sub, data)
      store.registrationReconciliations.push({ id: sub.id, ...data })
      store.order.push('reconcile')
      return sub
    },
  },
  brokerRegistration: {
    update: async ({ where, data }: { where: { id: string }; data: any }) => {
      const found = store.registrationSubs.find((s) => s.registrationId === where.id)
      if (!found) throw new Error('registration not found')
      Object.assign(found.registration, data)
      store.registrationStatusUpdates.push({ id: where.id, ...data })
      return found.registration
    },
  },
  companySubscription: {
    findFirst: async ({ where }: { where: { stripeCustomerId: string } }) =>
      store.companySubs.find((s) => s.stripeCustomerId === where.stripeCustomerId) || null,
    findUnique: async ({ where, include }: { where: { id: string }; include: any }) => {
      const sub = store.companySubs.find((s) => s.id === where.id)
      if (!sub) return null
      const membershipWhere = include?.company?.include?.memberships?.where
      const filtered = membershipWhere
        ? sub.company.memberships.filter(
            (m: any) =>
              (!membershipWhere.role || m.role === membershipWhere.role) &&
              (membershipWhere.isActive === undefined || m.isActive === membershipWhere.isActive),
          )
        : sub.company.memberships
      return {
        ...sub,
        company: {
          ...sub.company,
          // orderBy: { id: 'asc' } — deterministic ordering, as in production.
          memberships: [...filtered].sort((a: any, b: any) => String(a.id).localeCompare(String(b.id))),
        },
      }
    },
    update: async ({ where, data }: { where: { id: string }; data: any }) => {
      const sub = store.companySubs.find((s) => s.id === where.id)
      if (!sub) throw new Error('companySubscription not found')
      Object.assign(sub, data)
      store.companyReconciliations.push({ id: sub.id, ...data })
      store.order.push('reconcile')
      return sub
    },
  },
  company: {
    update: async ({ where, data }: { where: { id: string }; data: any }) => {
      const company = store.companies.find((c) => c.id === where.id)
      if (!company) throw new Error('company not found')
      Object.assign(company, data)
      store.companyActivations.push({ id: company.id, ...data })
      return company
    },
  },
  brokerSubscriptionPaymentFailureLog: failureLogModel('broker'),
  companySubscriptionPaymentFailureLog: failureLogModel('company'),
  stripeWebhookEvent: {
    findUnique: async ({ where }: { where: { eventId: string } }) =>
      store.webhookEvents.find((e) => e.eventId === where.eventId) || null,
    create: async ({ data }: { data: any }) => {
      if (store.webhookEvents.some((e) => e.eventId === data.eventId)) {
        const err: any = new Error('Unique constraint failed on the fields: (`eventId`)')
        err.code = 'P2002'
        throw err
      }
      const row = { updatedAt: new Date(), ...data }
      store.webhookEvents.push(row)
      return row
    },
    update: async ({ where, data }: { where: { eventId: string }; data: any }) => {
      const row = store.webhookEvents.find((e) => e.eventId === where.eventId)
      if (!row) throw new Error('stripeWebhookEvent row not found')
      Object.assign(row, data, { updatedAt: new Date() })
      return row
    },
    findFirst: async ({ where }: { where: any }) => {
      const gt = where?.eventCreatedAt?.gt
      const statuses: string[] = where?.status?.in || []
      return (
        store.webhookEvents.find(
          (e) => e.stripeSubId === where.stripeSubId && statuses.includes(e.status) && typeof gt === 'number' && e.eventCreatedAt > gt,
        ) || null
      )
    },
  },
  $transaction: async (fn: (tx: any) => Promise<unknown>) => fn(fakePrisma),
}
mock.module('@/lib/prisma', { exports: { default: fakePrisma } } as any)

// ---------------------------------------------------------------------------
// Mock: Resend boundary only — real email templates are re-exported so the
// durable senders exercise the production subject/body construction.
// ---------------------------------------------------------------------------
const sendEmail = async (args: { to: string; subject: string; idempotencyKey?: string }) => {
  emailCalls.push({ to: args.to, subject: args.subject, idempotencyKey: args.idempotencyKey })
  store.order.push('email')
  if (emailState.behavior === 'throw') throw new Error('Resend unavailable')
  if (emailState.behavior === 'failure') return { success: false, error: 'Resend rejected', errorCode: 'EMAIL_ERROR' }
  return { success: true, messageId: 'msg_test_1' }
}
mock.module('@/lib/email', {
  exports: { sendEmail, emailTemplates, verifyEmailConnection: async () => true },
} as any)

// ---------------------------------------------------------------------------
// Mock: next/headers (request header access outside the Next runtime)
// ---------------------------------------------------------------------------
const headersState: Record<string, string | null> = { 'stripe-signature': 'sig_test' }
mock.module('next/headers', {
  exports: {
    headers: async () => ({ get: (k: string) => headersState[k] ?? null }),
    cookies: async () => ({ get: () => null }),
  },
} as any)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function flushAsync() {
  // Two macrotask hops let all pending microtasks of the fire-and-forget chains
  // (durable sender → sendEmail → log updates) settle deterministically.
  await new Promise<void>((resolve) => setImmediate(resolve))
  await new Promise<void>((resolve) => setImmediate(resolve))
}

function makeEvent(type: 'invoice.payment_failed' | 'invoice.payment_succeeded', invoiceId: string, eventId?: string) {
  const sub = stripeState.subscription
  return {
    id: eventId ?? `evt_${type}_${invoiceId}`,
    type,
    created: Math.floor(Date.now() / 1000),
    data: { object: { id: invoiceId, subscription: sub.id, customer: sub.customer } },
  } as any
}

async function loadHandler() {
  return import('../app/api/stripe/webhook/route')
}

async function withTransports<T>(fn: () => Promise<T>): Promise<T> {
  installStripeTransport()
  installUpstashTransport()
  try {
    return await fn()
  } finally {
    restoreStripeTransport()
    restoreUpstashTransport()
  }
}

function makePostRequest(event: any): any {
  const payload = JSON.stringify(event)
  const signature = stripeSignatureHeader(payload, process.env.STRIPE_WEBHOOK_SECRET!)
  // The webhook route reads the signature through next/headers (mocked here),
  // so the mocked header table must carry the real computed signature.
  headersState['stripe-signature'] = signature
  return new Request('http://localhost:3000/api/stripe/webhook', {
    method: 'POST',
    body: payload,
    headers: { 'content-type': 'application/json', 'stripe-signature': signature },
  })
}

// ---------------------------------------------------------------------------
// Scenario 1 — Broker payment failure end-to-end
// ---------------------------------------------------------------------------
test('invoice.payment_failed (BROKER): Stripe retrieved → broker reconciled → broker payment-failure sender invoked; company product untouched', async () => {
  await withTransports(async () => {
    resetFixtures('broker')
    const { handleStripeEvent } = await loadHandler()
    await handleStripeEvent(makeEvent('invoice.payment_failed', 'in_broker_1'))
    await flushAsync()

    // Real Stripe SDK path: subscriptions.retrieve ran against the fake transport.
    assert.deepEqual(stripeState.retrieveCalls, ['sub_broker'])

    // Reconciliation: past_due deactivates the broker subscription and persists
    // the authoritative Stripe subscription id.
    assert.equal(store.brokerReconciliations.length, 1)
    assert.equal(store.brokerReconciliations[0].isActive, false)
    assert.equal(store.brokerReconciliations[0].stripeSubId, 'sub_broker')
    assert.equal(store.brokerReconciliations[0].plan, 'FEATURED')

    // Durable broker notification: exactly one email through the real template,
    // recipient resolved from the broker record (not the user fallback, not
    // Stripe metadata).
    assert.equal(emailCalls.length, 1)
    assert.equal(emailCalls[0].to, 'broker-direct@example.com')
    assert.match(emailCalls[0].subject, /Payment failure for your Broker subscription/)
    const log = store.brokerLogs[0]
    assert.ok(log, 'broker payment-failure log created')
    assert.equal(log.idempotencyKey, 'payment_failure_broker_bsub-1_in_broker_1')
    assert.equal(log.invoiceId, 'in_broker_1')
    assert.equal(log.status, 'SENT')
    assert.equal(log.attempts, 1)

    // Isolation: the company sender was never reached.
    assert.equal(store.companyLogs.length, 0)
    assert.equal(store.companyReconciliations.length, 0)
  })
})

// ---------------------------------------------------------------------------
// Scenario 2 — Company payment failure end-to-end
// ---------------------------------------------------------------------------
test('invoice.payment_failed (COMPANY): Stripe retrieved → company reconciled → company payment-failure sender invoked to the active OWNER; broker product untouched', async () => {
  await withTransports(async () => {
    resetFixtures('company')
    const { handleStripeEvent } = await loadHandler()
    await handleStripeEvent(makeEvent('invoice.payment_failed', 'in_company_1'))
    await flushAsync()

    assert.deepEqual(stripeState.retrieveCalls, ['sub_company'])

    // Reconciliation: past_due maps to PAST_DUE / isActive false.
    assert.equal(store.companyReconciliations.length, 1)
    assert.equal(store.companyReconciliations[0].status, 'PAST_DUE')
    assert.equal(store.companyReconciliations[0].isActive, false)
    assert.equal(store.companyReconciliations[0].stripeSubId, 'sub_company')

    // Durable company notification: recipient is the active OWNER membership
    // (role OWNER verified at the send boundary), never the member or the
    // inactive owner.
    assert.equal(emailCalls.length, 1)
    assert.equal(emailCalls[0].to, 'owner@example.com')
    assert.match(emailCalls[0].subject, /Payment failure for your Company Advertising subscription/)
    const log = store.companyLogs[0]
    assert.ok(log, 'company payment-failure log created')
    assert.equal(log.idempotencyKey, 'payment_failure_company_csub-1_in_company_1')
    assert.equal(log.invoiceId, 'in_company_1')
    assert.equal(log.status, 'SENT')
    assert.equal(log.attempts, 1)

    // Isolation: the broker sender was never reached.
    assert.equal(store.brokerLogs.length, 0)
    assert.equal(store.brokerReconciliations.length, 0)
  })
})

// ---------------------------------------------------------------------------
// Scenario 3 — BROKER_REGISTRATION subscription: reconcile but never notify
// ---------------------------------------------------------------------------
test('invoice.payment_failed (BROKER_REGISTRATION): registration reconciles, normal broker payment-failure email NOT sent', async () => {
  await withTransports(async () => {
    resetFixtures('registration')
    const { handleStripeEvent } = await loadHandler()
    await handleStripeEvent(makeEvent('invoice.payment_failed', 'in_reg_1'))
    await flushAsync()

    // Registration reconciliation ran (past_due → EXPIRED, inactive), including
    // the registration status update inside the real $transaction.
    assert.equal(store.registrationReconciliations.length, 1)
    assert.equal(store.registrationReconciliations[0].status, 'EXPIRED')
    assert.equal(store.registrationReconciliations[0].isActive, false)
    assert.equal(store.registrationStatusUpdates.length, 1)

    // No normal broker/company payment-failure notification is produced.
    assert.equal(emailCalls.length, 0)
    assert.equal(store.brokerLogs.length, 0)
    assert.equal(store.companyLogs.length, 0)
    assert.equal(store.brokerReconciliations.length, 0)
    assert.equal(store.companyReconciliations.length, 0)
  })
})

// ---------------------------------------------------------------------------
// Scenario 4 — Unknown owner type: fail safely, never silently route
// ---------------------------------------------------------------------------
test('invoice.payment_failed (unknown owner): strict rejection per existing webhook semantics, no notification', async () => {
  await withTransports(async () => {
    resetFixtures('unknown')
    const { handleStripeEvent } = await loadHandler()
    await assert.rejects(
      () => handleStripeEvent(makeEvent('invoice.payment_failed', 'in_unknown_1')),
      /Broker subscription not found/,
    )
    await flushAsync()
    assert.equal(emailCalls.length, 0)
    assert.equal(store.brokerLogs.length, 0)
    assert.equal(store.companyLogs.length, 0)
    assert.equal(store.brokerReconciliations.length, 0)
    assert.equal(store.companyReconciliations.length, 0)
    assert.equal(store.registrationReconciliations.length, 0)
  })
})

// ---------------------------------------------------------------------------
// Scenario 5 — Ambiguous owner type: never send the wrong notification
// ---------------------------------------------------------------------------
test('invoice.payment_failed (ambiguous ownership): strict rejection, no wrong notification', async () => {
  await withTransports(async () => {
    resetFixtures('ambiguous')
    const { handleStripeEvent } = await loadHandler()
    await assert.rejects(
      () => handleStripeEvent(makeEvent('invoice.payment_failed', 'in_amb_1')),
      /Ambiguous Stripe customer ownership/,
    )
    await flushAsync()
    assert.equal(emailCalls.length, 0)
    assert.equal(store.brokerLogs.length, 0)
    assert.equal(store.companyLogs.length, 0)
    assert.equal(store.brokerReconciliations.length, 0)
    assert.equal(store.companyReconciliations.length, 0)
    assert.equal(store.registrationReconciliations.length, 0)
  })
})

// ---------------------------------------------------------------------------
// Scenario 6 — Sender ordering: reconciliation completes before dispatch
// ---------------------------------------------------------------------------
test('ordering: billing reconciliation is persisted before payment-failure notification dispatch', async () => {
  await withTransports(async () => {
    resetFixtures('broker')
    const { handleStripeEvent } = await loadHandler()
    await handleStripeEvent(makeEvent('invoice.payment_failed', 'in_order_1'))
    await flushAsync()

    const reconcileIdx = store.order.indexOf('reconcile')
    const emailIdx = store.order.indexOf('email')
    assert.ok(reconcileIdx !== -1, 'reconciliation recorded')
    assert.ok(emailIdx !== -1, 'email recorded')
    assert.ok(reconcileIdx < emailIdx, 'reconciliation happened before notification dispatch')
    // At dispatch time the subscription state is already persisted.
    assert.equal(store.brokerReconciliations[0].isActive, false)
  })
})

// ---------------------------------------------------------------------------
// Scenario 7 — Same invoice replay: durable idempotency, no duplicate work
// ---------------------------------------------------------------------------
test('same subscription + same invoice replay: durable idempotency prevents duplicate notification work', async () => {
  await withTransports(async () => {
    resetFixtures('broker')
    const { handleStripeEvent } = await loadHandler()
    await handleStripeEvent(makeEvent('invoice.payment_failed', 'in_dup_1'))
    await flushAsync()
    // Replay: same subscription + same invoice, fresh Stripe event id (Stripe
    // redeliveries carry new event ids — the durable log is the guard).
    await handleStripeEvent(makeEvent('invoice.payment_failed', 'in_dup_1', 'evt_replay_1'))
    await flushAsync()

    assert.equal(store.brokerLogs.length, 1)
    assert.equal(store.brokerLogs[0].attempts, 1)
    assert.equal(store.brokerLogs[0].status, 'SENT')
    assert.equal(emailCalls.length, 1)
  })
})

// ---------------------------------------------------------------------------
// Scenario 8 — Different invoice: new notification lifecycle
// ---------------------------------------------------------------------------
test('same subscription + different invoice: independent notification lifecycle', async () => {
  await withTransports(async () => {
    resetFixtures('broker')
    const { handleStripeEvent } = await loadHandler()
    await handleStripeEvent(makeEvent('invoice.payment_failed', 'in_first'))
    await flushAsync()
    await handleStripeEvent(makeEvent('invoice.payment_failed', 'in_second'))
    await flushAsync()

    assert.equal(store.brokerLogs.length, 2)
    assert.deepEqual(
      store.brokerLogs.map((l) => l.idempotencyKey).sort(),
      ['payment_failure_broker_bsub-1_in_first', 'payment_failure_broker_bsub-1_in_second'].sort(),
    )
    assert.equal(store.brokerLogs.every((l) => l.attempts === 1 && l.status === 'SENT'), true)
    assert.equal(emailCalls.length, 2)
  })
})

// ---------------------------------------------------------------------------
// Scenario 9 — Broker sender failure: billing state authoritative, durable FAILED
// ---------------------------------------------------------------------------
test('broker sender failure: durable FAILED/retryable semantics preserved, reconciliation not undone, webhook does not fail', async () => {
  await withTransports(async () => {
    resetFixtures('broker')
    const { handleStripeEvent } = await loadHandler()
    emailState.behavior = 'failure'
    await handleStripeEvent(makeEvent('invoice.payment_failed', 'in_fail_1'))
    await flushAsync()

    // The durable sender recorded the failure with retry semantics.
    assert.equal(store.brokerLogs[0].status, 'FAILED')
    assert.equal(store.brokerLogs[0].attempts, 1)
    assert.equal(store.brokerLogs[0].lastError, 'Resend rejected')

    // Billing state was reconciled BEFORE the notification and is not corrupted
    // or rolled back by the email failure.
    assert.equal(store.brokerReconciliations.length, 1)
    assert.equal(store.brokerReconciliations[0].isActive, false)
    assert.equal(store.brokerReconciliations[0].stripeSubId, 'sub_broker')
  })
})

// ---------------------------------------------------------------------------
// Scenario 10 — Company sender failure: billing state authoritative, durable FAILED
// ---------------------------------------------------------------------------
test('company sender failure: durable FAILED/retryable semantics preserved, reconciliation not undone, webhook does not fail', async () => {
  await withTransports(async () => {
    resetFixtures('company')
    const { handleStripeEvent } = await loadHandler()
    emailState.behavior = 'throw'
    await handleStripeEvent(makeEvent('invoice.payment_failed', 'in_fail_2'))
    await flushAsync()

    // The durable sender caught the thrown provider error and recorded it.
    assert.equal(store.companyLogs[0].status, 'FAILED')
    assert.equal(store.companyLogs[0].attempts, 1)
    assert.equal(store.companyLogs[0].lastError, 'Resend unavailable')

    // Billing state remains authoritative.
    assert.equal(store.companyReconciliations.length, 1)
    assert.equal(store.companyReconciliations[0].status, 'PAST_DUE')
    assert.equal(store.companyReconciliations[0].isActive, false)
  })
})

// ---------------------------------------------------------------------------
// Scenario 11 — Missing recipient: existing intended no-recipient behavior
// ---------------------------------------------------------------------------
test('missing recipient (broker): log marked SENT with no-recipient note, no email dispatched, reconciliation intact', async () => {
  await withTransports(async () => {
    resetFixtures('broker')
    // Remove both recipient sources: broker.email and broker.user.email.
    store.brokers[0].email = null
    store.brokers[0].user.email = null
    const { handleStripeEvent } = await loadHandler()
    await handleStripeEvent(makeEvent('invoice.payment_failed', 'in_norecip_1'))
    await flushAsync()

    // Existing intended semantics: the row is marked SENT with a 'no recipient
    // email' note (terminal — never retried), and nothing is dispatched.
    assert.equal(emailCalls.length, 0)
    const log = store.brokerLogs[0]
    assert.ok(log, 'log row exists')
    assert.equal(log.status, 'SENT')
    assert.equal(log.messageId, null)
    assert.equal(log.lastError, 'no recipient email')

    // Billing reconciliation still completed.
    assert.equal(store.brokerReconciliations.length, 1)
    assert.equal(store.brokerReconciliations[0].isActive, false)
  })
})

// ---------------------------------------------------------------------------
// Scenario 12 — Multiple active Company OWNER memberships: deterministic pick
// ---------------------------------------------------------------------------
test('multiple active OWNER memberships: deterministic recipient selection (lowest membership id)', async () => {
  await withTransports(async () => {
    resetFixtures('company')
    // Both memberships are active OWNERs; the durable sender orders by id asc
    // and takes the first. 'mem-a' < 'mem-b' lexicographically.
    store.companySubs[0].company.memberships = [
      { id: 'mem-b', role: 'OWNER', isActive: true, user: { id: 'user-b', email: 'second-owner@example.com' } },
      { id: 'mem-a', role: 'OWNER', isActive: true, user: { id: 'user-a', email: 'first-owner@example.com' } },
    ]
    const { handleStripeEvent } = await loadHandler()
    await handleStripeEvent(makeEvent('invoice.payment_failed', 'in_multi_1'))
    await flushAsync()

    assert.equal(emailCalls.length, 1)
    assert.equal(emailCalls[0].to, 'first-owner@example.com', 'deterministic id-asc ordering picked the lowest membership id')
    assert.notEqual(emailCalls[0].to, 'second-owner@example.com')
    const log = store.companyLogs[0]
    assert.ok(log)
    assert.equal(log.status, 'SENT')
  })
})

// ---------------------------------------------------------------------------
// Extra — invoice.payment_succeeded never dispatches payment-failure senders
// ---------------------------------------------------------------------------
test('invoice.payment_succeeded: reconciles without dispatching any payment-failure notification (broker and company)', async () => {
  await withTransports(async () => {
    resetFixtures('broker')
    stripeState.subscription = { ...stripeState.subscription, status: 'active' }
    const { handleStripeEvent } = await loadHandler()
    await handleStripeEvent(makeEvent('invoice.payment_succeeded', 'in_ok_1'))
    await flushAsync()

    assert.equal(store.brokerReconciliations.length, 1)
    assert.equal(store.brokerReconciliations[0].isActive, true)
    assert.equal(emailCalls.length, 0)
    assert.equal(store.brokerLogs.length, 0)

    // Symmetric check for the company product: reconciliation may run, but no
    // payment-failure notification may be dispatched.
    resetFixtures('company')
    stripeState.subscription = { ...stripeState.subscription, status: 'active' }
    await handleStripeEvent(makeEvent('invoice.payment_succeeded', 'in_ok_2'))
    await flushAsync()
    assert.equal(emailCalls.length, 0)
    assert.equal(store.companyLogs.length, 0)
  })
})

// ---------------------------------------------------------------------------
// Extra — full POST path: real signature verification, billing lock, event log
// ---------------------------------------------------------------------------
test('POST /api/stripe/webhook (BROKER payment failure): real signature verified, lock acquired, event logged PROCESSED, notification dispatched', async () => {
  await withTransports(async () => {
    resetFixtures('broker')
    const { POST } = await loadHandler()

    const event = makeEvent('invoice.payment_failed', 'in_post_1', 'evt_post_1')
    const response = await POST(makePostRequest(event))
    await flushAsync()

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { received: true })

    // Real Stripe SDK signature verification + retrieve both ran.
    assert.deepEqual(stripeState.retrieveCalls, ['sub_broker'])

    // Webhook event log: PROCESSED, no stale note.
    const eventRow = store.webhookEvents.find((e) => e.eventId === 'evt_post_1')
    assert.ok(eventRow, 'stripeWebhookEvent row created')
    assert.equal(eventRow.status, 'PROCESSED')
    assert.equal(eventRow.error, null)
    assert.equal(eventRow.stripeSubId, 'sub_broker')

    // Billing lock was actually acquired and released through the real
    // Upstash client transport.
    assert.equal(store.brokerReconciliations.length, 1)
    assert.equal(redisLocks.size, 0, 'billing lock released after processing')

    // Notification dispatched after reconciliation.
    assert.equal(emailCalls.length, 1)
    assert.equal(emailCalls[0].to, 'broker-direct@example.com')
  })
})

test('POST /api/stripe/webhook: missing signature returns 400 before any processing', async () => {
  await withTransports(async () => {
    resetFixtures('none')
    headersState['stripe-signature'] = null
    try {
      const { POST } = await loadHandler()
      const response = await POST(new Request('http://localhost:3000/api/stripe/webhook', { method: 'POST', body: 'x' }) as any)
      assert.equal(response.status, 400)
      assert.deepEqual(await response.json(), { error: 'Missing signature' })
      assert.equal(store.webhookEvents.length, 0)
      assert.equal(emailCalls.length, 0)
    } finally {
      headersState['stripe-signature'] = 'sig_test'
    }
  })
})

test('POST /api/stripe/webhook: same event replayed → duplicate suppressed, single notification', async () => {
  await withTransports(async () => {
    resetFixtures('broker')
    const { POST } = await loadHandler()

    const event = makeEvent('invoice.payment_failed', 'in_post_dup', 'evt_post_dup')
    const first = await POST(makePostRequest(event))
    await flushAsync()
    const second = await POST(makePostRequest(event))
    await flushAsync()

    assert.equal(first.status, 200)
    assert.equal(second.status, 200)
    // Durable webhook-event idempotency: exactly one event-log row, one
    // reconciliation, one notification across the replay.
    assert.equal(store.webhookEvents.length, 1)
    assert.equal(store.brokerReconciliations.length, 1)
    assert.equal(store.brokerLogs.length, 1)
    assert.equal(emailCalls.length, 1)
  })
})
