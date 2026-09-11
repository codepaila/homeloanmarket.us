/* eslint-disable @typescript-eslint/no-explicit-any */
// Phase 8.41.3 — Company re-subscription activation email hardening.
//
// A CompanySubscription row is reused for the life of a company (one row per
// company). The durable activation email idempotency key is scoped to
// (companySubscriptionId, stripeSubscriptionId) — the Stripe subscription id is
// the authoritative activation identity — so a genuine cancel → re-subscribe
// produces exactly one NEW activation email for the new Stripe subscription
// while replays/duplicates of the SAME subscription stay suppressed.
//
// Scenario matrix (12):
//   TEST 1  First activation A                    → one SENT email, key scoped to sub_A
//   TEST 2  Duplicate webhook A                   → no duplicate email (event dedupe + durable key)
//   TEST 3  Cancel A                              → no activation email
//   TEST 4  Re-subscribe B (cancel A → active B)  → independent NEW email, key scoped to sub_B
//   TEST 5  Duplicate webhook B                   → still exactly one B email
//   TEST 6  Stale webhook replay of A after B     → refused (does not overwrite B, no email)
//   TEST 7  Concurrent activation B               → single durable SENT
//   TEST 8  Failed send then retry B              → FAILED → SENT on retry, no duplicate
//   TEST 9  Missing active-OWNER recipient B      → no email sent, no send loop
//   TEST 10 Broker activation regression          → broker email still exactly one (unchanged)
//   TEST 11 Payment-failure regression            → company payment-failure email unchanged, no activation email
//   TEST 12 Free plan activation                  → ACTIVE with no Stripe identity and no activation email
//
// Runtime harness: the REAL Stripe SDK and the REAL durable senders run against
// mocked transports (fake https.request for Stripe REST, fake global fetch for
// Upstash Redis REST) and an in-memory Prisma store. Only the external
// boundaries are mocked; production templates, idempotency machines, and the
// webhook reconciliation logic are exercised for real.
//
// Run: node --experimental-test-module-mocks --test --import tsx \
//        tests/phase-8.41.3-company-resubscription-activation-email.test.ts

import { mock, test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import crypto from 'node:crypto'
import { emailTemplates } from '../lib/email-templates'

const require_ = createRequire(import.meta.url)
const https = require_('node:https')

process.env.STRIPE_SECRET_KEY = 'sk_test_phase_8413'
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_phase_8413'
process.env.UPSTASH_REDIS_REST_URL = 'https://upstash-fake.test'
process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'

// ---------------------------------------------------------------------------
// Shared mutable state
// ---------------------------------------------------------------------------
type EmailLogRow = {
  id: string
  idempotencyKey: string
  companySubscriptionId: string
  stripeSubscriptionId: string | null
  status: string
  attempts: number
  leaseExpiresAt: Date | null
  claimedAt: Date | null
  sentAt: Date | null
  messageId: string | null
  lastError: string | null
}

const store = {
  companies: [] as any[],
  companySubs: [] as any[],
  advertisingPlans: [] as any[],
  companyLogs: [] as EmailLogRow[],
  companyPaymentFailureLogs: [] as any[],
  companyReconciliations: [] as any[],
  companyActivations: [] as any[],
  brokerSubs: [] as any[],
  brokers: [] as any[],
  brokerPlans: [] as any[],
  brokerLogs: [] as any[],
  brokerReconciliations: [] as any[],
  brokerFeatureUpdates: [] as any[],
  stripeWebhookEvents: [] as any[],
  order: [] as string[],
}

const emailCalls: Array<{ to: string | null; subject: string; idempotencyKey?: string }> = []
const emailState = { behavior: 'success' as 'success' | 'failure' | 'throw' }

// Stripe REST truth, keyed by subscription id. retrieve() of any subscription
// id returns the CURRENT live shape from this table.
const stripeState = {
  subscriptions: {} as Record<string, any>,
  calls: [] as string[],
}

const redisKeys = new Map<string, { value: string; expiresAt: number }>()

// ---------------------------------------------------------------------------
// Upstash Redis REST: served by a REAL local HTTP server speaking the Upstash
// REST protocol, so the REAL @upstash/redis client (Redis.fromEnv → set-nx/ex,
// get, del, eval) runs against a guaranteed-reachable endpoint without relying
// on global-fetch interception (which is unreliable across the repo's tsx +
// node:test mock-module graph). Lock behavior exercised is identical to
// production.
// ---------------------------------------------------------------------------
const http = require_('node:http')

function redisExpiredServer(key: string): boolean {
  const entry = redisKeys.get(key)
  if (!entry) return false
  if (entry.expiresAt <= Date.now()) {
    redisKeys.delete(key)
    return true
  }
  return false
}

function handleRedisCommand(command: any[]): { result: unknown; error: unknown } {
  const cmd = String(command[0]).toLowerCase()
  if (cmd === 'set') {
    const key = String(command[1])
    if (redisExpiredServer(key)) redisKeys.delete(key)
    const hasNx = command.slice(3).some((v: unknown) => String(v).toLowerCase() === 'nx')
    if (hasNx && redisKeys.has(key)) return { result: null, error: null }
    const exIndex = command.slice(3).findIndex((v: unknown) => String(v).toLowerCase() === 'ex')
    const ttl = exIndex >= 0 ? Number(command[4 + exIndex]) : 60
    redisKeys.set(key, { value: String(command[2]), expiresAt: Date.now() + ttl * 1000 })
    return { result: 'OK', error: null }
  }
  if (cmd === 'get') {
    if (redisExpiredServer(String(command[1]))) return { result: null, error: null }
    return { result: redisKeys.get(String(command[1]))?.value ?? null, error: null }
  }
  if (cmd === 'del') {
    const had = redisKeys.delete(String(command[1]))
    return { result: had ? 1 : 0, error: null }
  }
  if (cmd === 'eval') {
    const numKeys = Number(command[2])
    const key = String(command[3])
    const args = command.slice(3 + numKeys)
    if (redisExpiredServer(key)) return { result: 0, error: null }
    const current = redisKeys.get(key)?.value ?? null
    if (current === String(args[0])) {
      const ttl = Number(args[1] ?? 60)
      redisKeys.set(key, { value: current, expiresAt: Date.now() + ttl * 1000 })
      return { result: 1, error: null }
    }
    return { result: 0, error: null }
  }
  return { result: null, error: `unhandled redis command: ${cmd}` }
}

const redisServer = http.createServer((req: any, res: any) => {
  const chunks: Buffer[] = []
  req.on('data', (chunk: Buffer) => chunks.push(chunk))
  req.on('end', () => {
    const raw = Buffer.concat(chunks).toString('utf8')
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      res.writeHead(400, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ result: null, error: 'invalid JSON' }))
      return
    }
    const isPipeline = Array.isArray(parsed) && Array.isArray(parsed[0])
    const commands: any[][] = isPipeline ? (parsed as any[][]) : [parsed as any[]]
    const results = commands.map(handleRedisCommand)
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(isPipeline ? results : results[0]))
  })
})
let redisServerReady: Promise<void> | null = null
async function ensureRedisServer(): Promise<void> {
  if (process.env.UPSTASH_REDIS_REST_URL?.startsWith('http://127.0.0.1:')) return
  if (!redisServerReady) {
    redisServerReady = new Promise<void>((resolve) => redisServer.listen(0, '127.0.0.1', resolve)).then(() => {
      redisServer.unref?.()
      const redisPort = (redisServer.address() as any).port
      process.env.UPSTASH_REDIS_REST_URL = `http://127.0.0.1:${redisPort}`
    })
  }
  return redisServerReady
}

function resetAll() {
  store.companies = []
  store.companySubs = []
  store.advertisingPlans = []
  store.companyLogs = []
  store.companyPaymentFailureLogs = []
  store.companyReconciliations = []
  store.companyActivations = []
  store.brokerSubs = []
  store.brokers = []
  store.brokerPlans = []
  store.brokerLogs = []
  store.brokerReconciliations = []
  store.brokerFeatureUpdates = []
  store.stripeWebhookEvents = []
  store.order = []
  emailCalls.length = 0
  emailState.behavior = 'success'
  stripeState.subscriptions = {}
  stripeState.calls = []
  redisKeys.clear()
}

function stripeSubscription(id: string, status: string, opts: { customer?: string; ownerType?: string; priceId?: string } = {}) {
  return {
    id,
    object: 'subscription',
    customer: opts.customer ?? 'cus_company',
    status,
    metadata: { ownerType: opts.ownerType ?? 'COMPANY' },
    items: { data: [{ price: { id: opts.priceId ?? 'price_company' } }] },
  }
}

// Company fixture: one CompanySubscription row for the company (reused across
// activations), plus an active OWNER membership that carries the recipient.
function primeCompanyFixture(opts: { stripeSubId?: string | null; ownerEmail?: string | null; stripeCustomerId?: string | null } = {}) {
  const email = opts.ownerEmail === undefined ? 'owner@example.com' : opts.ownerEmail
  const ownerMembership = {
    id: 'mem-1',
    role: 'OWNER',
    isActive: true,
    user: { id: 'u-1', email },
  }
  store.companies = [
    { id: 'company-1', name: 'Acme Holdings', status: 'ACTIVE', memberships: [ownerMembership] },
  ]
  store.advertisingPlans = [
    { id: 'adv-1', name: 'Standard Advertising', price: 9900, currency: 'usd', billingInterval: 'month', stripePriceId: 'price_company' },
  ]
  store.companySubs = [
    {
      id: 'cs-1',
      companyId: 'company-1',
      plan: 'ADVERTISING',
      planId: null,
      status: 'CANCELED',
      isActive: false,
      startDate: null,
      endDate: new Date(),
      stripeCustomerId: opts.stripeCustomerId === undefined ? 'cus_company' : opts.stripeCustomerId,
      stripeSubId: opts.stripeSubId ?? null,
      company: store.companies[0],
    },
  ]
}

// ---------------------------------------------------------------------------
// Transport seam: Stripe REST API via https.request interception.
// The REAL Stripe SDK (signature verification, request building, response
// parsing) runs against this fake transport.
// ---------------------------------------------------------------------------
const realHttpsRequest = https.request

function fakeStripeResponseFor(path: string): unknown {
  if (path.startsWith('/v1/subscriptions/')) {
    const subId = path.split('?')[0].split('/').pop()
    if (subId && subId !== 'subscriptions') stripeState.calls.push(`GET /v1/subscriptions/${subId}`)
    const sub = stripeState.subscriptions[subId!]
    if (!sub) return { error: { message: `Unknown subscription in test transport: ${subId}`, type: 'invalid_request_error' } }
    return sub
  }
  if (path.startsWith('/v1/customers/')) {
    const customerId = path.split('?')[0].split('/').pop()
    stripeState.calls.push(`GET /v1/customers/${customerId}`)
    return { id: customerId, object: 'customer', deleted: false, metadata: {} }
  }
  stripeState.calls.push(`GET ${path.split('?')[0]}`)
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

function withTransports<T>(fn: () => Promise<T>): Promise<T> {
  return (async () => {
    installStripeTransport()
    try {
      await ensureRedisServer()
      return await fn()
    } finally {
      restoreStripeTransport()
    }
  })()
}

async function loadWebhook() {
  return import('../app/api/stripe/webhook/route')
}

async function flushAsync() {
  // Two macrotask hops let all pending microtasks of the fire-and-forget
  // chains (durable sender → sendEmail → log updates) settle deterministically.
  await new Promise<void>((resolve) => setImmediate(resolve))
  await new Promise<void>((resolve) => setImmediate(resolve))
}

// Computes a REAL Stripe webhook signature so the real webhooks.constructEvent
// signature verification runs in the POST-path tests.
function stripeSignatureHeader(payload: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex')
  return `t=${timestamp},v1=${signature}`
}

// Drives the production webhook entry (POST) with a real signed payload,
// exercising event dedupe, the per-subscription ordering guard, the billing
// lock, and handleStripeEvent end to end. Returns the parsed JSON body.
async function fireWebhookEvent(event: any): Promise<{ status: number; body: any }> {
  const { POST } = await loadWebhook()
  const payload = JSON.stringify(event)
  const signature = stripeSignatureHeader(payload, process.env.STRIPE_WEBHOOK_SECRET!)
  headersState['stripe-signature'] = signature
  const request = new Request('http://localhost:3000/api/stripe/webhook', {
    method: 'POST',
    body: payload,
    headers: { 'content-type': 'application/json', 'stripe-signature': signature },
  })
  const response = await POST(request as any)
  const body = await response.json()
  return { status: response.status, body }
}

function makeCheckoutEvent(subscriptionId: string, eventId: string, created?: number, opts: { customer?: string } = {}) {
  return {
    id: eventId,
    type: 'checkout.session.completed',
    created: created ?? Math.floor(Date.now() / 1000),
    data: { object: { id: `cs_test_${subscriptionId}_${eventId}`, customer: opts.customer ?? 'cus_company', subscription: subscriptionId } },
  } as any
}

function makeSubscriptionDeletedEvent(subscriptionId: string, eventId: string, created?: number) {
  return {
    id: eventId,
    type: 'customer.subscription.deleted',
    created: created ?? Math.floor(Date.now() / 1000),
    data: { object: stripeSubscription(subscriptionId, 'canceled') },
  } as any
}

function makeInvoiceFailedEvent(invoiceId: string, subscriptionId: string, eventId: string, created?: number) {
  return {
    id: eventId,
    type: 'invoice.payment_failed',
    created: created ?? Math.floor(Date.now() / 1000),
    data: { object: { id: invoiceId, subscription: subscriptionId, customer: 'cus_company' } },
  } as any
}

// ---------------------------------------------------------------------------
// Mock: Prisma (in-memory, semantics matched to the real callers)
// ---------------------------------------------------------------------------
function companyEmailLogRow(key: string, overrides: Partial<EmailLogRow> = {}): EmailLogRow {
  return {
    id: `cemail-${store.companyLogs.length + 1}`,
    idempotencyKey: key,
    companySubscriptionId: '',
    stripeSubscriptionId: null,
    status: 'PENDING',
    attempts: 0,
    leaseExpiresAt: null,
    claimedAt: null,
    sentAt: null,
    messageId: null,
    lastError: null,
    ...overrides,
  }
}

function companyEmailLogModel() {
  const rows = () => store.companyLogs
  return {
    upsert: async ({ where, create }: { where: { idempotencyKey: string }; create: Partial<EmailLogRow> }) => {
      const existing = rows().find((r) => r.idempotencyKey === where.idempotencyKey)
      if (existing) return existing
      const row = companyEmailLogRow(where.idempotencyKey, create)
      rows().push(row)
      return row
    },
    findUnique: async ({ where }: { where: { idempotencyKey: string } }) =>
      rows().find((r) => r.idempotencyKey === where.idempotencyKey) || null,
    update: async ({ where, data }: { where: { idempotencyKey: string }; data: Partial<EmailLogRow> }) => {
      const row = rows().find((r) => r.idempotencyKey === where.idempotencyKey)
      if (!row) throw new Error('company activation-email log row not found')
      Object.assign(row, data)
      return row
    },
    updateMany: async ({ where, data }: { where: any; data: any }) => {
      const row = rows().find((r) => r.idempotencyKey === where.idempotencyKey)
      if (!row) return { count: 0 }
      // Mirrors the durable sender's claimEligibleWhere semantics.
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
  }
}

function companyPaymentFailureLogModel() {
  const rows = () => store.companyPaymentFailureLogs
  return {
    upsert: async ({ where, create }: { where: { idempotencyKey: string }; create: any }) => {
      const existing = rows().find((r) => r.idempotencyKey === where.idempotencyKey)
      if (existing) return existing
      const row = {
        id: `cpay-${rows().length + 1}`,
        idempotencyKey: where.idempotencyKey,
        invoiceId: '',
        companySubscriptionId: '',
        status: 'PENDING',
        attempts: 0,
        leaseExpiresAt: null,
        claimedAt: null,
        sentAt: null,
        messageId: null,
        lastError: null,
        ...create,
      }
      rows().push(row)
      return row
    },
    findUnique: async ({ where }: { where: { idempotencyKey: string } }) =>
      rows().find((r) => r.idempotencyKey === where.idempotencyKey) || null,
    update: async ({ where, data }: { where: { idempotencyKey: string }; data: any }) => {
      const row = rows().find((r) => r.idempotencyKey === where.idempotencyKey)
      if (!row) throw new Error('company payment-failure log row not found')
      Object.assign(row, data)
      return row
    },
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
  }
}

function brokerEmailLogModel() {
  const rows = () => store.brokerLogs
  return {
    upsert: async ({ where, create }: { where: { idempotencyKey: string }; create: any }) => {
      const existing = rows().find((r) => r.idempotencyKey === where.idempotencyKey)
      if (existing) return existing
      const row = { id: `bemail-${rows().length + 1}`, idempotencyKey: where.idempotencyKey, status: 'PENDING', attempts: 0, leaseExpiresAt: null, claimedAt: null, sentAt: null, messageId: null, lastError: null, ...create }
      rows().push(row)
      return row
    },
    findUnique: async ({ where }: { where: { idempotencyKey: string } }) =>
      rows().find((r) => r.idempotencyKey === where.idempotencyKey) || null,
    update: async ({ where, data }: { where: { idempotencyKey: string }; data: any }) => {
      const row = rows().find((r) => r.idempotencyKey === where.idempotencyKey)
      if (!row) throw new Error('broker activation-email log row not found')
      Object.assign(row, data)
      return row
    },
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
  }
}

// Resolves the durable email-sender company lookup: findUnique by id with the
// company + OWNER membership (user) + advertisingPlan include shape.
function resolveCompanySubForFindUnique(where: { id?: string; companyId?: string }, include: any) {
  const sub = where.id
    ? store.companySubs.find((s) => s.id === where.id)
    : store.companySubs.find((s) => s.companyId === where.companyId)
  if (!sub) return null
  const membershipWhere = include?.company?.include?.memberships?.where
  const includeUser = include?.company?.include?.memberships?.include?.user
  const filtered = include?.company?.include?.memberships
    ? sub.company.memberships.filter(
        (m: any) =>
          (!membershipWhere?.role || m.role === membershipWhere.role) &&
          (membershipWhere?.isActive === undefined || m.isActive === membershipWhere.isActive),
      )
    : sub.company.memberships
  const resolvedMemberships = includeUser ? filtered.map((m: any) => ({ ...m, user: m.user ?? { id: `u-${m.id}`, email: null } })) : filtered
  return {
    ...sub,
    advertisingPlan: include?.advertisingPlan ? store.advertisingPlans.find((p) => p.id === sub.planId) || null : undefined,
    company: include?.company ? { ...sub.company, memberships: resolvedMemberships } : include?.company,
  }
}

const fakePrisma: any = {
  setting: { findUnique: async () => null },
  secureConfig: { findUnique: async () => null },
  brokerSubscriptionPlan: {
    findFirst: async ({ where }: { where: { stripePriceId: string } }) =>
      store.brokerPlans.find((p) => p.stripePriceId === where.stripePriceId) || null,
  },
  companyAdvertisingPlan: {
    findFirst: async ({ where }: { where: { stripePriceId?: string; id?: string } }) => {
      if (where.stripePriceId) return store.advertisingPlans.find((p) => p.stripePriceId === where.stripePriceId) || null
      if (where.id) return store.advertisingPlans.find((p) => p.id === where.id) || null
      return null
    },
    findUnique: async ({ where }: { where: { id: string } }) => store.advertisingPlans.find((p) => p.id === where.id) || null,
  },
  companySubscription: {
    findFirst: async ({ where, select }: { where: { stripeCustomerId: string }; select?: any }) => {
      const sub = store.companySubs.find((s) => s.stripeCustomerId === where.stripeCustomerId) || null
      if (!sub || !select) return sub
      const picked: any = {}
      for (const key of Object.keys(select)) if (key in sub) picked[key] = sub[key]
      return picked
    },
    findUnique: async ({ where, include }: { where: { id?: string; companyId?: string }; include?: any }) =>
      resolveCompanySubForFindUnique(where, include),
    upsert: async ({ where, create, update }: { where: { companyId: string }; create: any; update: any }) => {
      const existing = store.companySubs.find((s) => s.companyId === where.companyId)
      if (existing) {
        Object.assign(existing, update, { company: existing.company })
        return existing
      }
      const row = { ...create, id: `cs-${store.companySubs.length + 1}`, company: store.companies.find((c) => c.id === create.companyId) }
      store.companySubs.push(row)
      return row
    },
    update: async ({ where, data }: { where: { id: string; companyId?: string }; data: any }) => {
      const sub = where.id
        ? store.companySubs.find((s) => s.id === where.id)
        : store.companySubs.find((s) => s.companyId === where.companyId)
      if (!sub) throw new Error('companySubscription not found')
      Object.assign(sub, data)
      store.companyReconciliations.push({ id: sub.id, companyId: sub.companyId, ...data })
      store.order.push('reconcile-company')
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
  brokerSubscription: {
    findFirst: async ({ where, include }: { where: { stripeCustomerId: string }; include?: any }) => {
      const sub = store.brokerSubs.find((s) => s.stripeCustomerId === where.stripeCustomerId) || null
      if (!sub || !include?.broker) return sub
      return { ...sub, broker: { ...sub.broker, subscription: sub } }
    },
    findUnique: async ({ where, include }: { where: { id?: string; brokerId?: string }; include?: any }) => {
      const sub = where.id
        ? store.brokerSubs.find((s) => s.id === where.id)
        : store.brokerSubs.find((s) => s.brokerId === where.brokerId)
      if (!sub) return null
      if (include?.broker) {
        return {
          ...sub,
          broker: { ...sub.broker, subscription: sub, user: include.broker.include?.user ? sub.broker.user : sub.broker.user },
          planRef: include?.planRef ? store.brokerPlans.find((p) => p.id === sub.planId) || null : undefined,
        }
      }
      return sub
    },
    update: async ({ where, data }: { where: { id: string }; data: any }) => {
      const sub = store.brokerSubs.find((s) => s.id === where.id)
      if (!sub) throw new Error('brokerSubscription not found')
      Object.assign(sub, data)
      store.brokerReconciliations.push({ id: sub.id, ...data })
      store.order.push('reconcile-broker')
      return sub
    },
  },
  brokerRegistrationSubscription: {
    findFirst: async () => null,
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
  companySubscriptionEmailLog: companyEmailLogModel(),
  companySubscriptionPaymentFailureLog: companyPaymentFailureLogModel(),
  brokerSubscriptionEmailLog: brokerEmailLogModel(),
  stripeWebhookEvent: {
    findUnique: async ({ where }: { where: { eventId: string } }) =>
      store.stripeWebhookEvents.find((e) => e.eventId === where.eventId) || null,
    create: async ({ data }: { data: any }) => {
      if (store.stripeWebhookEvents.some((e) => e.eventId === data.eventId)) {
        const err: any = new Error('Unique constraint failed on the fields: (`eventId`)')
        err.code = 'P2002'
        throw err
      }
      const row = { updatedAt: new Date(), ...data }
      store.stripeWebhookEvents.push(row)
      return row
    },
    update: async ({ where, data }: { where: { eventId: string }; data: any }) => {
      const row = store.stripeWebhookEvents.find((e) => e.eventId === where.eventId)
      if (!row) throw new Error('stripeWebhookEvent row not found')
      Object.assign(row, data, { updatedAt: new Date() })
      return row
    },
    findFirst: async ({ where }: { where: any }) => {
      const gt = where?.eventCreatedAt?.gt
      const statuses: string[] = where?.status?.in || []
      const matches = store.stripeWebhookEvents.filter(
        (e) => e.stripeSubId === where.stripeSubId && statuses.includes(e.status) && typeof gt === 'number' && e.eventCreatedAt > gt,
      )
      matches.sort((a, b) => b.eventCreatedAt - a.eventCreatedAt)
      return matches[0] || null
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
// Mock: company webhook / checkout support modules
// ---------------------------------------------------------------------------
mock.module('@/lib/company-policy', {
  namedExports: {
    getCurrentCompany: async () => ({
      user: { id: 'u-1', email: 'owner@example.com' },
      company: store.companies[0],
    }),
  },
} as any)

mock.module('@/lib/origin', {
  namedExports: { isSameOriginRequest: () => true },
} as any)

mock.module('@/lib/company-onboarding-state', {
  namedExports: { isCompanyProfileComplete: () => true },
} as any)

mock.module('@/lib/company-coupon', {
  namedExports: { validateCompanyCoupon: async () => null },
} as any)

mock.module('@/lib/company-plan', {
  namedExports: {
    COMPANY_PLAN_DEFAULT_NAME: 'ADVERTISING',
    resolveCompanyPlanByStripePrice: async (priceId: string | null | undefined) =>
      priceId ? store.advertisingPlans.find((p) => p.stripePriceId === priceId) || null : null,
    resolveCompanyPlanForCheckout: async (planId?: string | null) =>
      store.advertisingPlans.find((p) => p.id === planId) || null,
    getCanonicalCompanyAdvertisingPlan: async () => store.advertisingPlans[0] || null,
  },
} as any)

// ---------------------------------------------------------------------------
// TEST 1 — First activation of subscription A sends exactly one durable email
// ---------------------------------------------------------------------------
test('TEST 1 | first activation A → one SENT activation email, key scoped to (cs-1, sub_A)', async () => {
  await withTransports(async () => {
    resetAll()
    primeCompanyFixture({ stripeSubId: null })
    stripeState.subscriptions.sub_A = stripeSubscription('sub_A', 'active')

    const res = await fireWebhookEvent(makeCheckoutEvent('sub_A', 'evt_checkout_A_1'))
    await flushAsync()
    assert.equal(res.status, 200)
    assert.equal(res.body.received, true)
    // Reconciliation: local row now tracks the authoritative Stripe sub.
    assert.equal(store.companyReconciliations.length, 1)
    assert.equal(store.companySubs[0].stripeSubId, 'sub_A')
    assert.equal(store.companySubs[0].status, 'ACTIVE')
    assert.equal(store.companySubs[0].isActive, true)
    assert.equal(store.companyActivations.length, 1)
    // Durable activation email: exactly one, recipient = active OWNER.
    assert.equal(emailCalls.length, 1)
    assert.equal(emailCalls[0].to, 'owner@example.com')
    assert.match(emailCalls[0].subject, /subscription is active/)
    const log = store.companyLogs[0]
    assert.ok(log, 'activation log created')
    assert.equal(log.idempotencyKey, 'company_subscription_activation_cs-1_sub_A')
    assert.equal(log.companySubscriptionId, 'cs-1')
    assert.equal(log.stripeSubscriptionId, 'sub_A')
    assert.equal(log.status, 'SENT')
    assert.equal(log.attempts, 1)
    // Broker product untouched.
    assert.equal(store.brokerLogs.length, 0)
    assert.equal(store.brokerReconciliations.length, 0)
  })
})

// ---------------------------------------------------------------------------
// TEST 2 — Duplicate/replay of webhook A: no second email (event dedupe AND
// durable-key idempotence)
// ---------------------------------------------------------------------------
test('TEST 2 | duplicate webhook A → no duplicate email (event dedupe + durable key)', async () => {
  await withTransports(async () => {
    resetAll()
    primeCompanyFixture({ stripeSubId: null })
    stripeState.subscriptions.sub_A = stripeSubscription('sub_A', 'active')

    // Drives the real production entry (POST → signature verification →
    // event dedupe → ordering guard → handleStripeEvent). Non-200 surfaces the
    // webhook error as a thrown message for assert.rejects.
    const processEvent = async (event: any) => {
      const res = await fireWebhookEvent(event)
      if (res.status !== 200) throw new Error(`Webhook POST failed (${res.status}): ${res.body?.error || 'unknown'}`)
      return res.body
    }
    await processEvent(makeCheckoutEvent('sub_A', 'evt_checkout_A_1'))
    await flushAsync()
    assert.equal(store.stripeWebhookEvents.length, 1, 'first delivery → one event row')

    // Same event id, re-delivered by Stripe: event-level dedupe skips it.
    await processEvent(makeCheckoutEvent('sub_A', 'evt_checkout_A_1'))
    await flushAsync()
    assert.equal(store.stripeWebhookEvents.length, 1, 'same-event-id redelivery is deduped (no new event row)')

    // A distinct event id for the SAME subscription is not an event-duplicate,
    // but the durable idempotency key (already SENT) must still suppress it.
    await processEvent(makeCheckoutEvent('sub_A', 'evt_checkout_A_2'))
    await flushAsync()
    assert.equal(store.stripeWebhookEvents.length, 2, 'distinct event id → a second event row (not an event dupe)')

    assert.equal(emailCalls.length, 1, 'exactly one email for sub_A across replays')
    assert.equal(store.companyLogs.length, 1, 'exactly one durable log row for sub_A')
    assert.equal(store.companyLogs[0].status, 'SENT')
    // The second event reconciles the same subscription idempotently — the
    // SAME row, never a duplicate subscription.
    assert.equal(store.companySubs.length, 1)
  })
})

// ---------------------------------------------------------------------------
// TEST 3 — Cancel of A (customer.subscription.deleted): no activation email
// ---------------------------------------------------------------------------
test('TEST 3 | cancel A → subscription canceled, NO activation email', async () => {
  await withTransports(async () => {
    resetAll()
    primeCompanyFixture({ stripeSubId: null })
    stripeState.subscriptions.sub_A = stripeSubscription('sub_A', 'active')

    // Drives the real production entry (POST → signature verification →
    // event dedupe → ordering guard → handleStripeEvent). Non-200 surfaces the
    // webhook error as a thrown message for assert.rejects.
    const processEvent = async (event: any) => {
      const res = await fireWebhookEvent(event)
      if (res.status !== 200) throw new Error(`Webhook POST failed (${res.status}): ${res.body?.error || 'unknown'}`)
      return res.body
    }
    // Establish A as active first.
    await processEvent(makeCheckoutEvent('sub_A', 'evt_checkout_A_1'))
    await flushAsync()
    assert.equal(emailCalls.length, 1)

    // Now cancel A.
    await processEvent(makeSubscriptionDeletedEvent('sub_A', 'evt_cancel_A_1'))
    await flushAsync()

    assert.equal(store.companySubs[0].status, 'CANCELED')
    assert.equal(store.companySubs[0].isActive, false)
    assert.equal(store.companySubs[0].stripeSubId, 'sub_A')
    assert.ok(store.companySubs[0].endDate, 'endDate set on cancellation')
    // Cancel produces no activation email.
    assert.equal(emailCalls.length, 1, 'no new email after cancel')
    assert.equal(store.companyLogs.length, 1, 'no new activation log row after cancel')
    assert.equal(store.companyLogs[0].status, 'SENT')
  })
})

// ---------------------------------------------------------------------------
// TEST 4 — Cancel → re-subscribe B: the new Stripe subscription activation is
// independently emailed (a NEW durable row, a NEW email)
// ---------------------------------------------------------------------------
test('TEST 4 | re-subscribe B after canceled A → independent NEW activation email (key scoped to (cs-1, sub_B))', async () => {
  await withTransports(async () => {
    resetAll()
    primeCompanyFixture({ stripeSubId: null })
    stripeState.subscriptions.sub_A = stripeSubscription('sub_A', 'active')

    // Drives the real production entry (POST → signature verification →
    // event dedupe → ordering guard → handleStripeEvent). Non-200 surfaces the
    // webhook error as a thrown message for assert.rejects.
    const processEvent = async (event: any) => {
      const res = await fireWebhookEvent(event)
      if (res.status !== 200) throw new Error(`Webhook POST failed (${res.status}): ${res.body?.error || 'unknown'}`)
      return res.body
    }
    await processEvent(makeCheckoutEvent('sub_A', 'evt_checkout_A_1'))
    await flushAsync()
    assert.equal(emailCalls.length, 1, 'A activation emailed once')

    // A is canceled (terminal) before B exists.
    await processEvent(makeSubscriptionDeletedEvent('sub_A', 'evt_cancel_A_1'))
    await flushAsync()
    stripeState.subscriptions.sub_A = stripeSubscription('sub_A', 'canceled')

    // Re-subscription B activates on the SAME CompanySubscription row.
    stripeState.subscriptions.sub_B = stripeSubscription('sub_B', 'active')
    await processEvent(makeCheckoutEvent('sub_B', 'evt_checkout_B_1'))
    await flushAsync()

    // AUTHORITATIVE assertions: same row reused, new Stripe sub tracked.
    assert.equal(store.companySubs.length, 1, 'still exactly one CompanySubscription row for the company')
    assert.equal(store.companySubs[0].stripeSubId, 'sub_B')
    assert.equal(store.companySubs[0].isActive, true)
    assert.equal(store.companySubs[0].status, 'ACTIVE')

    // NEW independent durable activation for B.
    assert.equal(emailCalls.length, 2, 'A then B = two activation emails')
    assert.equal(store.companyLogs.length, 2, 'one durable log row per Stripe subscription')
    const aLog = store.companyLogs.find((l) => l.idempotencyKey === 'company_subscription_activation_cs-1_sub_A')
    const bLog = store.companyLogs.find((l) => l.idempotencyKey === 'company_subscription_activation_cs-1_sub_B')
    assert.ok(aLog && aLog.status === 'SENT', 'A log row exists and is SENT')
    assert.ok(bLog && bLog.status === 'SENT', 'B log row exists and is SENT')
    assert.equal(bLog.stripeSubscriptionId, 'sub_B')
    assert.equal(bLog.companySubscriptionId, 'cs-1')
  })
})

// ---------------------------------------------------------------------------
// TEST 5 — Duplicate/replay of webhook B: still exactly one B email
// ---------------------------------------------------------------------------
test('TEST 5 | duplicate webhook B → still exactly one B activation email', async () => {
  await withTransports(async () => {
    resetAll()
    primeCompanyFixture({ stripeSubId: null })
    stripeState.subscriptions.sub_A = stripeSubscription('sub_A', 'active')
    // Drives the real production entry (POST → signature verification →
    // event dedupe → ordering guard → handleStripeEvent). Non-200 surfaces the
    // webhook error as a thrown message for assert.rejects.
    const processEvent = async (event: any) => {
      const res = await fireWebhookEvent(event)
      if (res.status !== 200) throw new Error(`Webhook POST failed (${res.status}): ${res.body?.error || 'unknown'}`)
      return res.body
    }
    await processEvent(makeCheckoutEvent('sub_A', 'evt_checkout_A_1'))
    await flushAsync()
    await processEvent(makeSubscriptionDeletedEvent('sub_A', 'evt_cancel_A_1'))
    await flushAsync()
    stripeState.subscriptions.sub_A = stripeSubscription('sub_A', 'canceled')

    stripeState.subscriptions.sub_B = stripeSubscription('sub_B', 'active')
    await processEvent(makeCheckoutEvent('sub_B', 'evt_checkout_B_1'))
    await flushAsync()
    assert.equal(emailCalls.length, 2)

    // Same-event-id replay: the webhook event-dedupe skips it entirely.
    const checkoutsForB = () => store.stripeWebhookEvents.filter((e) => e.stripeSubId === 'sub_B').length
    await processEvent(makeCheckoutEvent('sub_B', 'evt_checkout_B_1'))
    await flushAsync()
    assert.equal(checkoutsForB(), 1, 'same-event-id redelivery for sub_B is deduped (no new event row)')

    // Distinct-event-id replay for the same sub_B is not an event-duplicate,
    // but the durable key suppresses the email.
    await processEvent(makeCheckoutEvent('sub_B', 'evt_checkout_B_2'))
    await flushAsync()
    assert.equal(checkoutsForB(), 2, 'distinct event id for sub_B → a second event row')

    assert.equal(emailCalls.length, 2, 'no third email for B replays')
    assert.equal(store.companyLogs.length, 2, 'no new durable row for B replays')
    assert.equal(store.companyLogs.filter((l) => l.idempotencyKey === 'company_subscription_activation_cs-1_sub_B').length, 1)
  })
})

// ---------------------------------------------------------------------------
// TEST 6 — Stale webhook replay of A AFTER B is current: refused. The event-
// level ordering guard is keyed per Stripe subscription (no sub_A events → not
// stale there), so the company stale-subscription guard is the real protection:
// it must refuse, never overwrite B, and never dispatch email for A.
// ---------------------------------------------------------------------------
test('TEST 6 | stale replay of subscription A after B is current → refused, B preserved, no email', async () => {
  await withTransports(async () => {
    resetAll()
    primeCompanyFixture({ stripeSubId: null })
    stripeState.subscriptions.sub_B = stripeSubscription('sub_B', 'active')

    const first = await fireWebhookEvent(makeCheckoutEvent('sub_B', 'evt_checkout_B_1', 2000))
    await flushAsync()
    assert.equal(first.status, 200)
    assert.equal(store.companySubs[0].stripeSubId, 'sub_B')
    assert.equal(store.companySubs[0].isActive, true)

    // Old subscription A event arrives late (older created than B's events).
    stripeState.subscriptions.sub_A = stripeSubscription('sub_A', 'active')
    const bEmailCount = emailCalls.length

    // The company stale-sub guard retrieves the live sub_B (active) and MUST
    // refuse rather than overwrite the newer current subscription. The webhook
    // event layer sees no newer event for sub_A (ordering is keyed per Stripe
    // subscription), so this refusal proves the company-side guard is the one
    // that protected B here — and the event row is recorded FAILED.
    const replay = await fireWebhookEvent(makeCheckoutEvent('sub_A', 'evt_checkout_A_replay', 100))
    await flushAsync()
    assert.equal(replay.status, 500, 'stale replay rejected at the production entry')
    assert.equal(replay.body.error, 'Webhook processing failed')

    // Current subscription B is untouched.
    assert.equal(store.companySubs[0].stripeSubId, 'sub_B')
    assert.equal(store.companySubs[0].isActive, true)
    assert.equal(store.companySubs[0].status, 'ACTIVE')
    // No activation email for the stale A, and none for B either.
    assert.equal(emailCalls.length, bEmailCount, 'no email from the stale A replay')
    assert.equal(store.companyLogs.filter((l) => l.idempotencyKey === 'company_subscription_activation_cs-1_sub_A').length, 0)
    // The replay event was recorded FAILED at the persistent layer with the
    // company stale-subscription guard message.
    const aRow = store.stripeWebhookEvents.find((e) => e.eventId === 'evt_checkout_A_replay')
    assert.ok(aRow, 'replay event row exists')
    assert.equal(aRow.status, 'FAILED')
    assert.match(aRow.error, /does not match Company subscription/)
  })
})

// ---------------------------------------------------------------------------
// TEST 7 — Concurrent dispatch of B: at most one durable SENT, one email
// ---------------------------------------------------------------------------
test('TEST 7 | concurrent activation B → single durable SENT row, single email', async () => {
  await withTransports(async () => {
    resetAll()
    primeCompanyFixture({ stripeSubId: 'sub_B' })
    store.companySubs[0].status = 'ACTIVE'
    store.companySubs[0].isActive = true
    stripeState.subscriptions.sub_B = stripeSubscription('sub_B', 'active')

    const { sendCompanySubscriptionPurchaseEmailDurable } = await import('../lib/company-subscription-email')
    const results = await Promise.all([
      sendCompanySubscriptionPurchaseEmailDurable('cs-1', 'sub_B'),
      sendCompanySubscriptionPurchaseEmailDurable('cs-1', 'sub_B'),
    ])
    await flushAsync()

    const sent = results.filter((r) => r.status === 'sent')
    const skipped = results.filter((r) => r.status === 'skipped' && (r.reason === 'already_sent' || r.reason === 'claim_lost'))
    assert.equal(sent.length, 1, 'exactly one winner')
    assert.ok(skipped.length === 1, 'the other concurrent caller loses the claim or sees already_sent')
    assert.equal(emailCalls.length, 1, 'exactly one email delivered')
    assert.equal(store.companyLogs.length, 1, 'exactly one durable row')
    assert.equal(store.companyLogs[0].status, 'SENT')
    assert.equal(store.companyLogs[0].attempts, 1)
  })
})

// ---------------------------------------------------------------------------
// TEST 8 — Failed send then retry for B: FAILED → SENT on retry, single row
// ---------------------------------------------------------------------------
test('TEST 8 | failed-then-retry activation B → FAILED then SENT on retry, no duplicate', async () => {
  await withTransports(async () => {
    resetAll()
    primeCompanyFixture({ stripeSubId: 'sub_B' })
    store.companySubs[0].status = 'ACTIVE'
    store.companySubs[0].isActive = true
    stripeState.subscriptions.sub_B = stripeSubscription('sub_B', 'active')

    const { sendCompanySubscriptionPurchaseEmailDurable } = await import('../lib/company-subscription-email')

    emailState.behavior = 'failure'
    const failed = await sendCompanySubscriptionPurchaseEmailDurable('cs-1', 'sub_B')
    assert.equal(failed.status, 'failed')
    const failedRes = failed as { retryable: boolean }
    assert.equal(failedRes.retryable, true, 'transient send failure retries')
    assert.equal(store.companyLogs[0].status, 'FAILED')
    assert.equal(store.companyLogs[0].attempts, 1)

    emailState.behavior = 'success'
    const retried = await sendCompanySubscriptionPurchaseEmailDurable('cs-1', 'sub_B')
    assert.equal(retried.status, 'sent')
    assert.equal(store.companyLogs.length, 1, 'still a single durable row (key unchanged)')
    assert.equal(store.companyLogs[0].status, 'SENT')
    assert.equal(store.companyLogs[0].attempts, 2, 'attempt counter incremented on retry')

    // A third call after SENT is suppressed entirely.
    const after = await sendCompanySubscriptionPurchaseEmailDurable('cs-1', 'sub_B')
    assert.deepEqual(after, { status: 'skipped', reason: 'already_sent' })
    assert.equal(store.companyLogs.length, 1)
    assert.equal(store.companyLogs[0].attempts, 2)
  })
})

// ---------------------------------------------------------------------------
// TEST 9 — Missing active-OWNER recipient: no send loop, no email dispatched
// ---------------------------------------------------------------------------
test('TEST 9 | missing active-OWNER recipient → skipped no_recipient, no email sent', async () => {
  await withTransports(async () => {
    resetAll()
    primeCompanyFixture({ stripeSubId: 'sub_B', ownerEmail: null })
    store.companySubs[0].status = 'ACTIVE'
    store.companySubs[0].isActive = true
    stripeState.subscriptions.sub_B = stripeSubscription('sub_B', 'active')

    const { sendCompanySubscriptionPurchaseEmailDurable } = await import('../lib/company-subscription-email')
    const first = await sendCompanySubscriptionPurchaseEmailDurable('cs-1', 'sub_B')
    assert.deepEqual(first, { status: 'skipped', reason: 'no_recipient' })
    assert.equal(emailCalls.length, 0, 'no email dispatch without a recipient')

    const log = store.companyLogs[0]
    assert.equal(log.status, 'SENT')
    assert.equal(log.lastError, 'no recipient email')
    assert.equal(log.messageId, null)

    // Retries cannot re-send for a missing recipient (already terminal SENT).
    const again = await sendCompanySubscriptionPurchaseEmailDurable('cs-1', 'sub_B')
    assert.deepEqual(again, { status: 'skipped', reason: 'already_sent' })
    assert.equal(emailCalls.length, 0)
  })
})

// ---------------------------------------------------------------------------
// TEST 10 — Broker activation regression: broker email unchanged, company
// product untouched
// ---------------------------------------------------------------------------
function primeBrokerFixture() {
  const broker: any = {
    id: 'broker-1',
    displayName: 'Acme Mortgages',
    email: 'broker-direct@example.com',
    featuredRank: null,
    user: { id: 'u-broker', email: 'broker-direct@example.com' },
  }
  const sub: any = {
    id: 'bsub-1',
    brokerId: 'broker-1',
    plan: 'FEATURED',
    planId: 'plan-b',
    isActive: false,
    startDate: null,
    endDate: new Date(),
    stripeCustomerId: 'cus_broker',
    stripeSubId: null,
    broker,
  }
  broker.subscription = sub
  store.brokers = [broker]
  store.brokerSubs = [sub]
  store.brokerPlans = [{ id: 'plan-b', code: 'FEATURED', stripePriceId: 'price_broker', name: 'Featured' }]
}

test('TEST 10 | broker activation regression → exactly one broker email, company product untouched', async () => {
  await withTransports(async () => {
    resetAll()
    primeBrokerFixture()
    stripeState.subscriptions.sub_broker = stripeSubscription('sub_broker', 'active', {
      customer: 'cus_broker',
      ownerType: 'BROKER',
      priceId: 'price_broker',
    })

    // Drives the real production entry (POST → signature verification →
    // event dedupe → ordering guard → handleStripeEvent). Non-200 surfaces the
    // webhook error as a thrown message for assert.rejects.
    const processEvent = async (event: any) => {
      const res = await fireWebhookEvent(event)
      if (res.status !== 200) throw new Error(`Webhook POST failed (${res.status}): ${res.body?.error || 'unknown'}`)
      return res.body
    }
    await processEvent(makeCheckoutEvent('sub_broker', 'evt_checkout_broker_1', undefined, { customer: 'cus_broker' }))
    await flushAsync()

    assert.equal(store.brokerReconciliations.length, 1)
    assert.equal(store.brokerSubs[0].stripeSubId, 'sub_broker')
    assert.equal(store.brokerSubs[0].isActive, true)
    assert.equal(store.brokerFeatureUpdates.length, 1, 'broker features applied')

    // Broker activation email unchanged: exactly one, broker key prefix.
    assert.equal(emailCalls.length, 1)
    assert.equal(emailCalls[0].to, 'broker-direct@example.com')
    assert.match(emailCalls[0].subject, /subscription is active/)
    assert.equal(store.brokerLogs.length, 1)
    assert.equal(store.brokerLogs[0].idempotencyKey, 'subscription_purchase_bsub-1')
    assert.equal(store.brokerLogs[0].status, 'SENT')

    // Company product untouched.
    assert.equal(store.companyLogs.length, 0)
    assert.equal(store.companyReconciliations.length, 0)
    assert.equal(store.companyLogs.length, 0)
  })
})

// ---------------------------------------------------------------------------
// TEST 11 — Payment-failure regression for the company product: unchanged, and
// a payment failure produces no activation email
// ---------------------------------------------------------------------------
test('TEST 11 | company payment-failure regression → payment-failure email only, no activation email', async () => {
  await withTransports(async () => {
    resetAll()
    primeCompanyFixture({ stripeSubId: 'sub_B' })
    store.companySubs[0].status = 'ACTIVE'
    store.companySubs[0].isActive = true
    store.companySubs[0].planId = 'adv-1'
    store.companySubs[0].plan = 'Standard Advertising'
    store.companySubs[0].startDate = new Date()
    stripeState.subscriptions.sub_B = stripeSubscription('sub_B', 'past_due')

    // Drives the real production entry (POST → signature verification →
    // event dedupe → ordering guard → handleStripeEvent). Non-200 surfaces the
    // webhook error as a thrown message for assert.rejects.
    const processEvent = async (event: any) => {
      const res = await fireWebhookEvent(event)
      if (res.status !== 200) throw new Error(`Webhook POST failed (${res.status}): ${res.body?.error || 'unknown'}`)
      return res.body
    }
    await processEvent(makeInvoiceFailedEvent('in_B_1', 'sub_B', 'evt_invoice_B_1'))
    await flushAsync()

    // Reconciliation to PAST_DUE / inactive, keyed by payment-failure sender.
    assert.equal(store.companySubs[0].status, 'PAST_DUE')
    assert.equal(store.companySubs[0].isActive, false)
    assert.equal(store.companyPaymentFailureLogs.length, 1)
    assert.equal(store.companyPaymentFailureLogs[0].idempotencyKey, 'payment_failure_company_cs-1_in_B_1')
    assert.equal(store.companyPaymentFailureLogs[0].status, 'SENT')

    // Exactly one email: the payment-failure email, NOT an activation email.
    assert.equal(emailCalls.length, 1)
    assert.match(emailCalls[0].subject, /Action required: Payment failure/)
    assert.equal(emailCalls[0].to, 'owner@example.com')

    // No activation log and no activation email were produced.
    assert.equal(store.companyLogs.length, 0, 'no activation-email durable row')
    assert.equal(emailCalls.some((c) => /subscription is active/.test(c.subject)), false)
  })
})

// ---------------------------------------------------------------------------
// TEST 12 — Free-plan activation: ACTIVE immediately with no Stripe identity
// and no activation email (existing behavior preserved)
// ---------------------------------------------------------------------------
test('TEST 12 | free plan activation → ACTIVE immediately, no Stripe identity, no activation email', async () => {
  await withTransports(async () => {
    resetAll()
    primeCompanyFixture({ stripeSubId: null, stripeCustomerId: null })
    // The FREE plan: zero price, no Stripe price id.
    store.advertisingPlans = [{ id: 'adv-free-1', name: 'Free Advertising', price: 0, currency: 'usd', billingInterval: 'month', stripePriceId: null }]

    const { POST } = await import('../app/api/company/subscription/checkout/route')
    const request = new Request('http://localhost:3000/api/company/subscription/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ planId: 'adv-free-1' }),
    })
    const response = await POST(request as any)
    await flushAsync()

    const body = await response.json()
    assert.equal(response.status, 200)
    assert.equal(body.free, true)
    assert.equal(body.success, true)
    assert.equal(body.url, null)
    assert.equal(body.planId, 'adv-free-1')

    // Activated on the SAME single CompanySubscription row.
    assert.equal(store.companySubs.length, 1)
    assert.equal(store.companySubs[0].status, 'ACTIVE')
    assert.equal(store.companySubs[0].isActive, true)
    assert.equal(store.companySubs[0].plan, 'Free Advertising')
    // No invented Stripe identity anywhere on the free path.
    assert.equal(store.companySubs[0].stripeSubId, null)
    assert.equal(store.companySubs[0].stripeCustomerId, null)
    // The company row is ACTIVE but no activation email was sent for a free
    // activation (email only ever flows from a Stripe checkout webhook).
    assert.equal(emailCalls.length, 0, 'no activation email for free activation')
    assert.equal(store.companyLogs.length, 0, 'no activation-email durable row for free activation')
    // No Stripe REST request was made (no checkout session, no customer, no
    // subscription) — the free path is Stripe-free end to end.
    assert.deepEqual(stripeState.calls, [], 'no Stripe REST traffic on the free path')
  })
})