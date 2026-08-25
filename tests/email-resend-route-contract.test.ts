import { mock, test } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'

// ===========================================================================
// Runtime contract tests for POST /api/auth/resend-verification.
//
// The route must:
//  - never accept a client-supplied userId
//  - return a stable errorCode (EMAIL_SEND_FAILED / RATE_LIMITED)
//  - never expose raw provider errors or tokens to the browser
//  - support a newly registered broker that has no Broker profile yet
//  - stay enumeration-resistant for unknown / already-verified accounts
//
// Uses Node experimental module mocking; run with --experimental-test-module-mocks.
// ===========================================================================

type MockEmailResult = { success: boolean; error?: string; errorCode?: string }

let dbUser: {
  id: string
  email: string
  name: string
  emailVerified: boolean
  brokerProfile: { id: string }[]
} | null = {
  id: 'user-1',
  email: 'broker@example.com',
  name: 'Broker One',
  emailVerified: false,
  brokerProfile: [],
}

let sendUserResult: MockEmailResult = { success: true }
let resendBrokerResult: MockEmailResult = { success: true }
let rateLimitAllowed = true

mock.module('@/actions/email.action', {
  namedExports: {
    resendBrokerVerificationEmail: async () => ({ ...resendBrokerResult }),
    sendUserVerificationEmail: async () => ({ ...sendUserResult }),
  },
})

mock.module('@/lib/prisma', {
  defaultExport: {
    user: {
      findUnique: async () => dbUser,
    },
  },
})

mock.module('@/lib/rateLimit', {
  namedExports: {
    resendVerificationRateLimit: {
      limit: async () => ({ success: rateLimitAllowed }),
    },
  },
})

type RouteModule = { POST: (req: NextRequest) => Promise<Response> }
let resendRoute: RouteModule

test('load the resend route under mocked dependencies', async () => {
  resendRoute = await import('../app/api/auth/resend-verification/route')
  assert.equal(typeof resendRoute.POST, 'function')
})

const post = (body: unknown) =>
  resendRoute.POST(
    new NextRequest('https://homeloanmarket.com/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
      body: JSON.stringify(body),
    }),
  )

test('rate limited -> 429 with RATE_LIMITED and safe message', async () => {
  rateLimitAllowed = false
  const res = await post({ email: 'broker@example.com' })
  rateLimitAllowed = true
  assert.equal(res.status, 429)
  const data = await res.json()
  assert.equal(data.success, false)
  assert.equal(data.errorCode, 'RATE_LIMITED')
  assert.match(data.error, /Please wait before requesting another verification email/)
})

test('broker without Broker profile resends via the user flow -> success', async () => {
  dbUser = { id: 'user-1', email: 'broker@example.com', name: 'B', emailVerified: false, brokerProfile: [] }
  sendUserResult = { success: true }
  const res = await post({ email: 'broker@example.com' })
  assert.equal(res.status, 200)
  const data = await res.json()
  assert.equal(data.success, true)
  assert.equal(data.message, 'Verification email sent successfully')
  assert.equal('error' in data, false, 'no error field on success')
})

test('user-flow provider failure -> 500 EMAIL_SEND_FAILED with no raw provider error', async () => {
  dbUser = { id: 'user-1', email: 'broker@example.com', name: 'B', emailVerified: false, brokerProfile: [] }
  sendUserResult = { success: false, error: 'Provider rejected' }
  const res = await post({ email: 'broker@example.com' })
  assert.equal(res.status, 500)
  const data = await res.json()
  assert.equal(data.success, false)
  assert.equal(data.errorCode, 'EMAIL_SEND_FAILED')
  assert.equal(data.error, 'Unable to send verification email')
  assert.doesNotMatch(JSON.stringify(data), /Provider rejected/, 'raw provider error must not reach the browser')
  assert.doesNotMatch(JSON.stringify(data), /token/i, 'verification token must not be returned')
})

test('broker with profile resend failure -> 500 EMAIL_SEND_FAILED', async () => {
  dbUser = { id: 'user-1', email: 'broker@example.com', name: 'B', emailVerified: false, brokerProfile: [{ id: 'broker-1' }] }
  resendBrokerResult = { success: false, error: 'Provider rejected' }
  const res = await post({ email: 'broker@example.com' })
  assert.equal(res.status, 500)
  const data = await res.json()
  assert.equal(data.success, false)
  assert.equal(data.errorCode, 'EMAIL_SEND_FAILED')
  assert.equal(data.error, 'Unable to send verification email')
})

test('broker with profile resend success -> 200 success', async () => {
  dbUser = { id: 'user-1', email: 'broker@example.com', name: 'B', emailVerified: false, brokerProfile: [{ id: 'broker-1' }] }
  resendBrokerResult = { success: true }
  const res = await post({ email: 'broker@example.com' })
  assert.equal(res.status, 200)
  const data = await res.json()
  assert.equal(data.success, true)
  assert.equal(data.message, 'Verification email sent successfully')
})

test('already-verified account returns the generic message (no email, no enumeration)', async () => {
  dbUser = { id: 'user-1', email: 'broker@example.com', name: 'B', emailVerified: true, brokerProfile: [] }
  sendUserResult = { success: true }
  const res = await post({ email: 'broker@example.com' })
  assert.equal(res.status, 200)
  const data = await res.json()
  assert.equal(data.success, true)
  assert.match(data.message, /If an account exists with this email/)
})

test('unknown account returns the generic message (no enumeration)', async () => {
  dbUser = null
  const res = await post({ email: 'nobody@example.com' })
  assert.equal(res.status, 200)
  const data = await res.json()
  assert.equal(data.success, true)
  assert.match(data.message, /If an account exists with this email/)
})

test('missing email -> 400', async () => {
  const res = await post({})
  assert.equal(res.status, 400)
  const data = await res.json()
  assert.equal(data.success, false)
  assert.equal(data.error, 'Email is required')
})

test('a browser-supplied userId in the body is ignored (route looks up by email only)', async () => {
  dbUser = { id: 'user-1', email: 'broker@example.com', name: 'B', emailVerified: false, brokerProfile: [] }
  sendUserResult = { success: true }
  // Send another user's id in the payload; the server must act on the email's owner only.
  const res = await post({ email: 'broker@example.com', userId: 'attacker-controlled-id' })
  assert.equal(res.status, 200)
  const data = await res.json()
  assert.equal(data.success, true)
})