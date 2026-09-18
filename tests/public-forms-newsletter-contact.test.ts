import { NextRequest } from 'next/server'
import { mock, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

// ===========================================================================
// PUBLIC FORMS — Footer newsletter + public Contact form
//
// Static source audits prove the proxy/authorization boundary and validation
// wiring. Runtime tests (mock.module, run with --experimental-test-module-mocks)
// prove both public endpoints work for unauthenticated visitors and never leak
// provider/DB errors.
// ===========================================================================

const TEST_DIR = path.dirname(new URL(import.meta.url).pathname)
const read = (relative: string): string => fs.readFileSync(path.resolve(TEST_DIR, '..', relative), 'utf8')

// ---------------------------------------------------------------------------
// Static audits — proxy authorization boundary
// ---------------------------------------------------------------------------

test('proxy whitelists POST /api/newsletter for anonymous footer signups', () => {
  const proxy = read('proxy.ts')
  assert.match(proxy, /\{\s*method:\s*'POST',\s*pattern:\s*\/\^\\\/api\\\/newsletter/, 'newsletter POST is method-aware public')
})

test('proxy whitelists POST /api/contact for anonymous submissions', () => {
  const proxy = read('proxy.ts')
  assert.match(proxy, /\{\s*method:\s*'POST',\s*pattern:\s*\/\^\\\/api\\\/contact\\\/\?\$/, 'public contact POST is method-aware public')
})

test('proxy never whitelists /api/admin/contact for any method', () => {
  const proxy = read('proxy.ts')
  assert.doesNotMatch(proxy, /pattern:\s*\/\^\\\/api\\\/admin/, 'no public method-aware exception may target /api/admin/*')
  assert.doesNotMatch(proxy, /path\.startsWith\('\/api\/admin/, 'the public path list must not include /api/admin/*')
})

test('authorization remains authoritative in the admin contact route GET handler', () => {
  const route = read('app/api/admin/contact/route.ts')
  assert.match(route, /export async function GET/, 'admin GET is preserved')
  assert.match(route, /user\.role !== 'ADMIN'/, 'GET enforces ADMIN')
  assert.match(route, /status:\s*401/, 'GET returns 401 for non-admins')
  assert.doesNotMatch(route, /export async function POST/, 'the public POST was moved out of the admin route')
})

test('public contact route stays thin and reuses the shared submission logic', () => {
  const route = read('app/api/contact/route.ts')
  assert.match(route, /from '@\/lib\/contact-submission'/, 'uses the shared submission module')
  assert.match(route, /contactBrokerRateLimit\.limit\(`site-contact:/, 'enforces the existing distributed limiter')
  assert.match(route, /validateContactSubmission\(payload\)/, 'server-side validation')
  assert.match(route, /deliverContactSubmission\(payload\)/, 'delegates both email purposes to the shared flow')
})

test('shared contact submission module owns validation and both email purposes', () => {
  const shared = read('lib/contact-submission.ts')
  assert.match(shared, /isValidEmail\(input\.email\)/, 'email validation is shared')
  assert.match(shared, /platformConfig\.adminEmails/, 'uses the canonical admin recipients')
  assert.match(shared, /emailTemplates\.notification/, 'reuses the existing email template')
  assert.match(shared, /sendEmail\(/, 'reuses the existing email provider')
  assert.match(shared, /site_contact_admin_\$\{fingerprint\}/, 'admin notification has a deterministic idempotency key')
  assert.match(shared, /site_contact_confirmation_\$\{fingerprint\}/, 'submitter confirmation has a distinct idempotency key')
  assert.match(shared, /sendAdminContactNotification/, 'admin notification has its own delivery attempt')
  assert.match(shared, /sendSubmitterContactConfirmation/, 'submitter confirmation has its own delivery attempt')
  assert.match(shared, /platformConfig\.supportEmail/, 'submitter confirmation avoids exposing an admin reply-to')
})

// ---------------------------------------------------------------------------
// Static audits — validation + UX
// ---------------------------------------------------------------------------

test('newsletter route validates, normalizes, rate-limits, and stays idempotent', () => {
  const route = read('app/api/newsletter/route.ts')
  assert.match(route, /isValidEmail\(email\)/, 'server-side email validation')
  assert.match(route, /\.trim\(\)\.toLowerCase\(\)/, 'normalizes trim -> lowercase')
  assert.match(route, /contactBrokerRateLimit\.limit\(`newsletter:/, 'reuses the existing distributed limiter')
  assert.match(route, /idempotencyKey: `newsletter_\$\{email\}`/, 'preserves the existing idempotency key')
  assert.match(route, /alreadySubscribed/, 'handles duplicate subscriptions idempotently')
})

test('footer newsletter validates before submitting and guards double submit', () => {
  const footer = read('components/layout/Footer.tsx')
  assert.match(footer, /if \(newsletterLoading\) return/, 'double submission is prevented')
  assert.match(footer, /Please enter a valid email address\./, 'client validation message')
  assert.match(footer, /email\.trim\(\)\.toLowerCase\(\)/, 'client normalizes the email')
  assert.match(footer, /disabled=\{newsletterLoading\}/, 'submit is disabled while loading')
})

test('contact form client validates bounds and surfaces friendly errors', () => {
  const client = read('app/(public)/contact/ContactPageClient.tsx')
  assert.match(client, /MESSAGE_MAX = 5000/, 'message max bound present')
  assert.match(client, /SUBJECT_MAX = 200/, 'subject max bound present')
  assert.match(client, /if \(loading\) return/, 'double submission is prevented')
  assert.match(client, /Please enter a valid email address/, 'client email validation message')
})

// ---------------------------------------------------------------------------
// Runtime harness — mocked dependencies
// ---------------------------------------------------------------------------

type SendCall = {
  to: string | string[]
  subject: string
  html: string
  text?: string
  idempotencyKey?: string
  replyTo?: string
}

type MockSendResult = { success: boolean; skipped?: boolean; messageId?: string; error?: string; errorCode?: string }

const sendState: {
  calls: SendCall[]
  result: MockSendResult
  // When non-empty, consumed in order so tests can fail the admin email and the
  // submitter confirmation independently.
  resultQueue: MockSendResult[]
} = {
  calls: [],
  result: { success: true, messageId: 'mock_message_id' },
  resultQueue: [],
}

const rateState = { success: true }

const platformConfig = {
  resendApiKey: 'test_key',
  emailFrom: 'noreply@homeloanmarket.com',
  emailFromName: 'HomeLoanMarket',
  supportEmail: null,
  adminEmails: ['admin@example.com'] as string[],
  emailReplyTo: null,
  emailUnsubscribe: null,
  appUrl: 'https://homeloanmarket.com',
}

mock.module('@/lib/email', {
  namedExports: {
    isValidEmail: (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    sendEmail: async (args: SendCall) => {
      sendState.calls.push(args)
      if (sendState.resultQueue.length > 0) return sendState.resultQueue.shift()!
      return sendState.result
    },
    emailTemplates: {
      notification: (data: { title: string; message: string; info?: Record<string, string> }) => ({
        subject: data.title,
        html: [
          `<h1>${data.title}</h1>`,
          `<p>${data.message}</p>`,
          ...Object.entries(data.info || {}).map(([key, value]) => `<div>${key}: ${value}</div>`),
        ].join(''),
      }),
    },
  },
})

mock.module('@/lib/rateLimit', {
  namedExports: {
    contactBrokerRateLimit: {
      limit: async () => ({ success: rateState.success }),
    },
  },
})

mock.module('@/lib/platform-config', {
  namedExports: {
    platformConfig,
    parseAdminEmails: () => platformConfig.adminEmails,
  },
})

mock.module('@/lib/prisma', {
  defaultExport: {
    contactMessage: { create: async () => ({ id: 'msg-1' }), findMany: async () => [], count: async () => 0 },
    broker: { findUnique: async () => null, update: async () => ({}) },
  },
})

mock.module('@/lib/currentUser', {
  namedExports: {
    getCurrentUser: async () => null,
  },
})

const newsletterRoute = () => import('../app/api/newsletter/route')
const contactRoute = () => import('../app/api/contact/route')
const adminContactRoute = () => import('../app/api/admin/contact/route')

function post(handler: (req: Request) => Promise<Response>, url: string, body: unknown, headers: Record<string, string> = {}) {
  return handler(
    new NextRequest(`https://homeloanmarket.com${url}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7', ...headers },
      body: JSON.stringify(body),
    }) as unknown as Request,
  )
}

const postNewsletter = (body: unknown, headers?: Record<string, string>) =>
  newsletterRoute().then(({ POST }) => post(POST as never, '/api/newsletter', body, headers))

const postContact = (body: unknown, headers?: Record<string, string>) =>
  contactRoute().then(({ POST }) => post(POST as never, '/api/contact', body, headers))

const getAdminContacts = () =>
  adminContactRoute().then(({ GET }) =>
    GET(
      new NextRequest('https://homeloanmarket.com/api/admin/contact', {
        method: 'GET',
        headers: { 'x-forwarded-for': '203.0.113.7' },
      }),
    ),
  )

const VALID_CONTACT = {
  name: 'Jane Buyer',
  email: 'jane@example.com',
  phone: '+1 (555) 987-6543',
  subject: 'Mortgage question',
  message: 'I would like help finding a mortgage originator in Austin.',
}

function reset() {
  sendState.calls.length = 0
  sendState.result = { success: true, messageId: 'mock_message_id' }
  sendState.resultQueue = []
  rateState.success = true
  platformConfig.adminEmails = ['admin@example.com']
}

// ---------------------------------------------------------------------------
// Newsletter runtime
// ---------------------------------------------------------------------------

test('newsletter: anonymous valid email succeeds and notifies admins', async () => {
  reset()
  const res = await postNewsletter({ email: 'user@example.com' })
  assert.notEqual(res.status, 401, 'anonymous submission must never be 401')
  assert.equal(res.status, 200)
  assert.equal((await res.json()).success, true)
  assert.equal(sendState.calls.length, 1)
  assert.deepEqual(sendState.calls[0].to, ['admin@example.com'])
  assert.equal(sendState.calls[0].idempotencyKey, 'newsletter_user@example.com')
})

test('newsletter: email is normalized (trim -> lowercase) before send', async () => {
  reset()
  const res = await postNewsletter({ email: '  User+Newsletter@Example.COM  ' })
  assert.equal(res.status, 200)
  assert.equal(sendState.calls[0].idempotencyKey, 'newsletter_user+newsletter@example.com')
  assert.match(sendState.calls[0].text || '', /user\+newsletter@example\.com/)
})

test('newsletter: invalid and empty emails are rejected with a friendly 400', async () => {
  for (const email of ['abc', 'abc@', '@example.com', 'user@', 'user @example.com', '', '   ']) {
    reset()
    const res = await postNewsletter({ email })
    assert.equal(res.status, 400, `${JSON.stringify(email)} must be rejected`)
    const data = await res.json()
    assert.equal(data.success, false)
    assert.match(data.error, /valid email address/i)
    assert.equal(sendState.calls.length, 0, `${JSON.stringify(email)} must not send email`)
  }
})

test('newsletter: duplicate subscription is idempotent and friendly', async () => {
  reset()
  sendState.result = { success: true, skipped: true }
  const res = await postNewsletter({ email: 'user@example.com' })
  assert.equal(res.status, 200)
  const data = await res.json()
  assert.equal(data.success, true)
  assert.match(data.message, /already subscribed/i)
})

test('newsletter: rate limit returns 429 without sending', async () => {
  reset()
  rateState.success = false
  const res = await postNewsletter({ email: 'user@example.com' })
  assert.equal(res.status, 429)
  assert.equal(sendState.calls.length, 0)
})

test('newsletter: provider failure returns a friendly 502 (no provider details)', async () => {
  reset()
  sendState.result = { success: false, error: 'Resend exploded', errorCode: 'EMAIL_ERROR' }
  const res = await postNewsletter({ email: 'user@example.com' })
  assert.equal(res.status, 502)
  const data = await res.json()
  assert.equal(data.success, false)
  assert.doesNotMatch(JSON.stringify(data), /resend|exploded|EMAIL_ERROR/i)
})

test('newsletter: missing admin configuration returns a friendly 503', async () => {
  reset()
  platformConfig.adminEmails = []
  const res = await postNewsletter({ email: 'user@example.com' })
  assert.equal(res.status, 503)
  assert.equal(sendState.calls.length, 0)
})

// ---------------------------------------------------------------------------
// Contact runtime
// ---------------------------------------------------------------------------

test('contact: anonymous valid submission succeeds and sends BOTH emails', async () => {
  reset()
  const res = await postContact(VALID_CONTACT)
  assert.notEqual(res.status, 401, 'anonymous submission must never be 401')
  assert.equal(res.status, 200)
  assert.equal((await res.json()).success, true)

  assert.equal(sendState.calls.length, 2, 'admin notification + submitter confirmation')
  const [adminCall, confirmationCall] = sendState.calls

  assert.deepEqual(adminCall.to, ['admin@example.com'], 'admin notification goes to admins')
  assert.equal(adminCall.replyTo, 'jane@example.com', 'admin can reply to the submitter')

  assert.equal(confirmationCall.to, 'jane@example.com', 'confirmation goes to the submitter')
  assert.notDeepEqual(confirmationCall.to, adminCall.to, 'admin and submitter are distinct recipients')
})

test('contact: authenticated submission also succeeds (no user dependency)', async () => {
  reset()
  const res = await postContact(VALID_CONTACT, { cookie: 'authjs.session-token=whatever' })
  assert.equal(res.status, 200)
  assert.equal(sendState.calls.length, 2)
})

test('contact: admin notification includes ALL configured admins', async () => {
  reset()
  platformConfig.adminEmails = ['admin1@example.com', 'admin2@example.com']
  const res = await postContact(VALID_CONTACT)
  assert.equal(res.status, 200)
  const adminCall = sendState.calls[0]
  assert.deepEqual(adminCall.to, ['admin1@example.com', 'admin2@example.com'], 'every configured admin is included')
})

test('contact: admin notification contains the submission details (no secrets)', async () => {
  reset()
  const res = await postContact(VALID_CONTACT)
  assert.equal(res.status, 200)
  const adminCall = sendState.calls[0]
  const body = `${adminCall.html}\n${adminCall.text}`
  assert.match(body, /Jane Buyer/)
  assert.match(body, /jane@example\.com/)
  assert.match(body, /Mortgage question/)
  assert.match(body, /finding a mortgage originator in Austin/)
  assert.doesNotMatch(body, /test_key/, 'no provider secrets')
})

test('contact: submitter confirmation confirms receipt and does not expose admins/ids', async () => {
  reset()
  const res = await postContact(VALID_CONTACT)
  assert.equal(res.status, 200)
  const confirmationCall = sendState.calls[1]
  const body = `${confirmationCall.subject}\n${confirmationCall.html}\n${confirmationCall.text}`
  assert.match(confirmationCall.subject, /received/i, 'subject confirms receipt')
  assert.match(body, /received your message/i)
  assert.doesNotMatch(body, /admin@example\.com/, 'no admin addresses leak to the submitter')
  assert.doesNotMatch(body, /msg-|contact_message|site_contact_admin/, 'no internal ids leak')
  assert.notEqual(confirmationCall.replyTo, 'admin@example.com', 'reply-to must not expose an admin address')
})

test('contact: invalid email rejected with friendly 400 and no email at all', async () => {
  reset()
  const res = await postContact({ ...VALID_CONTACT, email: 'not-an-email' })
  assert.equal(res.status, 400)
  assert.match((await res.json()).error, /valid email address/i)
  assert.equal(sendState.calls.length, 0)
})

test('contact: required fields rejected', async () => {
  const cases: Array<[Record<string, unknown>, RegExp]> = [
    [{ ...VALID_CONTACT, name: '' }, /name/i],
    [{ ...VALID_CONTACT, phone: '' }, /phone/i],
    [{ ...VALID_CONTACT, subject: '' }, /subject/i],
    [{ ...VALID_CONTACT, message: '' }, /message/i],
  ]
  for (const [body, pattern] of cases) {
    reset()
    const res = await postContact(body)
    assert.equal(res.status, 400)
    assert.match((await res.json()).error, pattern)
    assert.equal(sendState.calls.length, 0)
  }
})

test('contact: message length is validated on both ends', async () => {
  reset()
  const short = await postContact({ ...VALID_CONTACT, message: 'too short' })
  assert.equal(short.status, 400)

  reset()
  const long = await postContact({ ...VALID_CONTACT, message: 'x'.repeat(5001) })
  assert.equal(long.status, 400)
  assert.match((await long.json()).error, /message/i)
})

test('contact: rate limit returns 429 without sending either email', async () => {
  reset()
  rateState.success = false
  const res = await postContact(VALID_CONTACT)
  assert.equal(res.status, 429)
  assert.equal(sendState.calls.length, 0)
})

test('contact: admin provider failure returns 502 and does NOT send a confirmation', async () => {
  reset()
  sendState.resultQueue = [{ success: false, error: 'Resend exploded', errorCode: 'EMAIL_ERROR' }]
  const res = await postContact(VALID_CONTACT)
  assert.equal(res.status, 502)
  const data = await res.json()
  assert.equal(data.success, false)
  assert.doesNotMatch(JSON.stringify(data), /resend|exploded|EMAIL_ERROR/i)
  assert.equal(sendState.calls.length, 1, 'a failed submission must not claim receipt to the submitter')
})

test('contact: submitter confirmation failure does NOT fail a valid submission', async () => {
  reset()
  sendState.resultQueue = [
    { success: true, messageId: 'admin_ok' },
    { success: false, error: 'Resend exploded', errorCode: 'EMAIL_ERROR' },
  ]
  const res = await postContact(VALID_CONTACT)
  assert.equal(res.status, 200, 'admin delivery succeeded, so the submission is accepted')
  assert.equal((await res.json()).success, true)
  assert.equal(sendState.calls.length, 2, 'the confirmation was still attempted independently')
})

test('contact: missing admin configuration returns a friendly 503', async () => {
  reset()
  platformConfig.adminEmails = []
  const res = await postContact(VALID_CONTACT)
  assert.equal(res.status, 503)
  assert.equal(sendState.calls.length, 0)
})

test('contact: idempotency keys are deterministic and distinct per purpose', async () => {
  reset()
  await postContact(VALID_CONTACT)
  const first = sendState.calls.map((call) => call.idempotencyKey)
  assert.equal(first.length, 2)
  assert.ok(first[0]?.startsWith('site_contact_admin_'), 'admin key is namespaced')
  assert.ok(first[1]?.startsWith('site_contact_confirmation_'), 'confirmation key is namespaced')
  assert.notEqual(first[0], first[1], 'the two purposes never share one key')

  sendState.calls.length = 0
  await postContact(VALID_CONTACT)
  const second = sendState.calls.map((call) => call.idempotencyKey)
  assert.deepEqual(second, first, 'identical submissions produce identical keys (existing sendEmail dedupe)')
})

// ---------------------------------------------------------------------------
// Admin boundary — /api/admin/contact remains protected
// ---------------------------------------------------------------------------

test('admin contact GET rejects anonymous callers with 401', async () => {
  const res = await getAdminContacts()
  assert.equal(res.status, 401, 'admin read must stay protected')
  assert.equal((await res.json()).success, false)
})

test('admin contact route exposes no public POST export', async () => {
  const route = (await adminContactRoute()) as unknown as Record<string, unknown>
  assert.equal(route.POST, undefined, 'the public POST must not exist on the admin route')
})
