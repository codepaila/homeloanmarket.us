import { NextRequest } from 'next/server'
import { mock, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

// ===========================================================================
// SEC-02 — Public broker contact (/api/contacts/send) abuse hardening.
//
// Static audits prove server-side validation, distributed limits, bounded
// storage, no internal-id leakage, and server-derived recipients. Runtime tests
// (mock.module) prove the behavior with mocked DB/email/limiters.
// ===========================================================================

const TEST_DIR = path.dirname(new URL(import.meta.url).pathname)
const read = (relative: string): string => fs.readFileSync(path.resolve(TEST_DIR, '..', relative), 'utf8')

const routeSource = read('app/api/contacts/send/route.ts')
const rateLimitSource = read('lib/rateLimit.ts')

test('contacts/send validates all bounded fields server-side', () => {
  assert.match(routeSource, /validateBrokerContactSubmission/)
  assert.match(routeSource, /isValidEmail\(input\.email\)/)
  assert.match(routeSource, /BROKER_CONTACT_NAME_MAX/)
  assert.match(routeSource, /BROKER_CONTACT_SUBJECT_MAX/)
  assert.match(routeSource, /BROKER_CONTACT_MESSAGE_MAX/)
  assert.match(routeSource, /BROKER_CONTACT_METADATA_MAX/)
  assert.match(routeSource, /BROKER_CONTACT_LOAN_AMOUNT_MAX/)
  assert.doesNotMatch(routeSource, /\.slice\(0, BROKER_CONTACT_MESSAGE_MAX\)/, 'oversized content is rejected, not truncated')
})

test('contacts/send uses the existing distributed limiter + broker-target guard', () => {
  assert.match(routeSource, /contactBrokerRateLimit\.limit\(`contact:\$\{ip\}`\)/)
  assert.match(routeSource, /contactBrokerRateLimit\.limit\(`contact-email:\$\{input\.email\}`\)/)
  assert.match(routeSource, /contactBrokerTargetRateLimit/)
  assert.match(routeSource, /getClientIP\(request\.headers\)/)
  assert.match(rateLimitSource, /export const contactBrokerTargetRateLimit/)
})

test('contacts/send resolves recipients server-side and never returns internal ids', () => {
  assert.match(routeSource, /const brokerNotificationEmail = broker\.email \|\| broker\.user\?\.email/)
  assert.match(routeSource, /to: input\.email/)
  assert.doesNotMatch(routeSource, /messageId/, 'internal message id must not appear in the response')
  assert.doesNotMatch(routeSource, /brokerEmail/, 'client-supplied broker email must be ignored')
})

// ---------------------------------------------------------------------------
// Runtime harness
// ---------------------------------------------------------------------------

type SendCall = { to: string | string[]; subject: string; html: string; idempotencyKey?: string; text?: string }

const sendState: { calls: SendCall[]; resultQueue: Array<{ success: boolean; skipped?: boolean; error?: string; errorCode?: string }> } = {
  calls: [],
  resultQueue: [],
}

const rateState = { ip: true, broker: true }

const dbState: {
  broker: Record<string, unknown> | null
  created: Array<Record<string, unknown>>
} = { broker: null, created: [] }

function reset() {
  sendState.calls.length = 0
  sendState.resultQueue = []
  rateState.ip = true
  rateState.broker = true
  dbState.created.length = 0
  dbState.broker = {
    id: '507f1f77bcf86cd799439011',
    profileSlug: 'acme',
    isVisible: true,
    verificationStatus: 'VERIFIED',
    brokerStatus: 'FREE',
    creationSource: 'ADMIN_CREATED',
    userId: 'owner-1',
    displayName: 'Acme Mortgage',
    companyName: 'Acme Mortgage LLC',
    email: 'broker@acme.com',
    user: { email: 'owner@acme.com', isActive: true },
  }
}

mock.module('@/lib/email', {
  namedExports: {
    isValidEmail: (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    htmlToText: (html: string) => html.replace(/<[^>]+>/g, ' '),
    emailTemplates: {
      newContactMessage: () => ({ subject: 'New contact message', html: '<p>broker</p>' }),
      contactMessageConfirmation: () => ({ subject: 'We received your message', html: '<p>received</p>' }),
    },
    sendEmail: async (args: SendCall) => {
      sendState.calls.push(args)
      if (sendState.resultQueue.length > 0) return sendState.resultQueue.shift() as never
      return { success: true, messageId: 'provider-id' } as never
    },
  },
})

mock.module('@/lib/rateLimit', {
  namedExports: {
    contactBrokerRateLimit: { limit: async () => ({ success: rateState.ip }) },
    contactBrokerTargetRateLimit: { limit: async () => ({ success: rateState.broker }) },
  },
})

mock.module('@/lib/prisma', {
  defaultExport: {
    broker: {
      findUnique: async () => dbState.broker,
      update: async () => ({}),
    },
    contactMessage: {
      create: async (args: { data: Record<string, unknown> }) => {
        dbState.created.push(args.data)
        return { id: 'msg-1', createdAt: new Date(), ...args.data }
      },
    },
  },
})

const route = () => import('../app/api/contacts/send/route')

function post(body: unknown, headers: Record<string, string> = {}) {
  return route().then(({ POST }) =>
    POST(
      new NextRequest('https://homeloanmarket.com/api/contacts/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7', ...headers },
        body: JSON.stringify(body),
      }),
    ),
  )
}

const VALID = {
  brokerSlug: 'acme',
  name: 'Jane Buyer',
  email: '  Jane@Example.COM ',
  phone: '+1 (555) 987-6543',
  subject: 'Mortgage question',
  message: 'I would like help finding a mortgage originator in Austin.',
  contactType: 'email',
  city: 'Austin',
  timeline: 'exploring',
  agreeToTerms: true,
}

test('anonymous valid contact succeeds; recipients are server-derived; no messageId leaks', async () => {
  reset()
  const res = await post({ ...VALID, brokerEmail: 'attacker@evil.test' })
  assert.equal(res.status, 200)
  const data = await res.json()
  assert.equal(data.success, true)
  assert.equal('messageId' in data, false)
  assert.equal(JSON.stringify(data).includes('msg-1'), false)

  assert.equal(sendState.calls.length, 2)
  assert.equal(sendState.calls[0].to, 'broker@acme.com', 'broker notification goes to the stored broker email')
  assert.equal(sendState.calls[1].to, 'jane@example.com', 'confirmation goes to the normalized submitter only')
  assert.equal(dbState.created.length, 1)
  assert.equal(dbState.created[0].email, 'jane@example.com', 'stored email is normalized')
})

test('invalid email is rejected with 400 and creates no message / email', async () => {
  reset()
  const res = await post({ ...VALID, email: 'not-an-email' })
  assert.equal(res.status, 400)
  assert.equal(dbState.created.length, 0)
  assert.equal(sendState.calls.length, 0)
})

test('oversized fields are rejected with 400 and create no message', async () => {
  const cases: Array<[string, string]> = [
    ['name', 'x'.repeat(101)],
    ['subject', 'x'.repeat(201)],
    ['message', 'x'.repeat(5001)],
    ['city', 'x'.repeat(101)],
  ]
  for (const [field, value] of cases) {
    reset()
    const res = await post({ ...VALID, [field]: value })
    assert.equal(res.status, 400, `${field} must be rejected`)
    assert.equal(dbState.created.length, 0, `${field} must not persist`)
  }
})

test('invalid broker identifier is rejected without a database lookup', async () => {
  reset()
  dbState.broker = null
  const res = await post({ ...VALID, brokerSlug: '', brokerId: 'not-an-object-id' })
  assert.equal(res.status, 404)
  assert.equal(dbState.created.length, 0)
  assert.equal(sendState.calls.length, 0)
})

test('missing broker returns a safe 404 and creates no message', async () => {
  reset()
  dbState.broker = null
  const res = await post({ ...VALID, brokerSlug: 'does-not-exist' })
  assert.equal(res.status, 404)
  assert.equal(dbState.created.length, 0)
})

test('rate limit returns 429 and creates no message / email', async () => {
  reset()
  rateState.ip = false
  const res = await post(VALID)
  assert.equal(res.status, 429)
  assert.equal(dbState.created.length, 0)
  assert.equal(sendState.calls.length, 0)
})

test('broker-target rate limit returns 429 and creates no message', async () => {
  reset()
  rateState.broker = false
  const res = await post(VALID)
  assert.equal(res.status, 429)
  assert.equal(dbState.created.length, 0)
  assert.equal(sendState.calls.length, 0)
})

test('broker notification failure returns a safe 502 with no provider details', async () => {
  reset()
  sendState.resultQueue = [{ success: false, error: 'Resend exploded', errorCode: 'EMAIL_ERROR' }]
  const res = await post(VALID)
  assert.equal(res.status, 502)
  const data = await res.json()
  assert.equal(data.success, false)
  assert.doesNotMatch(JSON.stringify(data), /resend|exploded|EMAIL_ERROR/i)
})

test('customer confirmation failure does not fail an accepted submission', async () => {
  reset()
  sendState.resultQueue = [
    { success: true },
    { success: false, error: 'Resend exploded', errorCode: 'EMAIL_ERROR' },
  ]
  const res = await post(VALID)
  assert.equal(res.status, 200)
  assert.equal((await res.json()).success, true)
})

test('duplicate identical submissions produce deterministic idempotency keys', async () => {
  reset()
  await post(VALID)
  const first = sendState.calls.map((call) => call.idempotencyKey)
  assert.ok(first[0]?.startsWith('broker_contact_notification_'))
  assert.ok(first[1]?.startsWith('broker_contact_confirmation_'))

  sendState.calls.length = 0
  await post(VALID)
  assert.deepEqual(sendState.calls.map((call) => call.idempotencyKey), first)
})
