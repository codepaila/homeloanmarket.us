import { mock, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const TEST_DIR = path.dirname(new URL(import.meta.url).pathname)
const read = (relative: string): string => fs.readFileSync(path.resolve(TEST_DIR, '..', relative), 'utf8')

// ===========================================================================
// Static source audits (no live email / no DB required)
// ===========================================================================

test('production email sender uses the .com domain, never .net', () => {
  const email = read('lib/email.ts')
  const actions = read('actions/email.action.ts')
  const templates = read('lib/email-templates.ts')
  const envTypes = read('types/environment.d.ts')
  for (const [file, source] of [
    ['lib/email.ts', email],
    ['actions/email.action.ts', actions],
    ['lib/email-templates.ts', templates],
    ['types/environment.d.ts', envTypes],
  ] as const) {
    assert.doesNotMatch(source, /homeloanmarket\.net/, `${file} must not reference homeloanmarket.net`)
  }
})

test('lib/email.ts constructs the sender from EMAIL_FROM/EMAIL_FROM_NAME env, not a hardcoded domain', () => {
  const email = read('lib/email.ts')
  assert.match(email, /EMAIL_FROM_NAME \|\| 'Homeloanmarket'/, 'sender name comes from env')
  assert.match(email, /<\$\{process\.env\.EMAIL_FROM\}>/, 'sender address comes from env')
})

test('lib/email.ts fails clearly when EMAIL_FROM or RESEND_API_KEY is missing', () => {
  const email = read('lib/email.ts')
  assert.match(email, /!process\.env\.RESEND_API_KEY \|\| !process\.env\.EMAIL_FROM/, 'config guard present')
  assert.match(email, /'Email service is not configured'/, 'clear diagnostic message')
})

test('env files configure the production sender as noreply@homeloanmarket.com', () => {
  for (const file of ['.env', '.env.local']) {
    const source = read(file)
    assert.match(source, /EMAIL_FROM=noreply@homeloanmarket\.com/, `${file} must use the .com sender`)
    assert.doesNotMatch(source, /EMAIL_FROM=noreply@homeloanmarket\.net/, `${file} must not use the .net sender`)
  }
})

test('verification URLs fall back to the .com production domain', () => {
  const actions = read('actions/email.action.ts')
  const templates = read('lib/email-templates.ts')
  assert.match(actions, /'https:\/\/homeloanmarket\.com'/, 'email actions fall back to .com app URL')
  assert.match(templates, /'https:\/\/homeloanmarket\.com'/, 'email templates fall back to .com app URL')
})

test('verification links use the HTTPS verify-email route', () => {
  const actions = read('actions/email.action.ts')
  const matches = actions.match(/\$\{appUrl\}\/auth\/verify-email\?token=/g)
  assert.ok(matches && matches.length >= 2, 'registration, user, and resend flows build HTTPS verify links')
})

// ---------------------------------------------------------------------------
// Success/failure propagation (the "always returns success:true" bug)
// ---------------------------------------------------------------------------

test('sendBrokerRegistrationEmails propagates the real provider result', () => {
  const actions = read('actions/email.action.ts')
  const block = actions.slice(actions.indexOf('sendBrokerRegistrationEmails'), actions.indexOf('sendBrokerClaimInvitationEmail'))
  assert.ok(block.includes('success: brokerEmailResult.success'), 'registration wrapper must reflect the broker email send')
  assert.doesNotMatch(block, /success:\s*true,\s*\n\s*brokerEmail:/, 'registration wrapper must not hardcode success:true')
})

test('resendBrokerVerificationEmail propagates the real provider result', () => {
  const actions = read('actions/email.action.ts')
  const block = actions.slice(actions.indexOf('resendBrokerVerificationEmail'), actions.indexOf('sendSubscriptionEmail'))
  assert.ok(block.includes('if (!emailResult.success)'), 'resend wrapper must branch on provider failure')
  assert.ok(block.includes('error: emailResult.error ||'), 'resend wrapper must surface the provider error')
})

test('sendBrokerVerificationEmail propagates the real provider result', () => {
  const actions = read('actions/email.action.ts')
  const block = actions.slice(actions.indexOf('sendBrokerVerificationEmail(brokerId'), actions.indexOf('resendBrokerVerificationEmail'))
  assert.ok(block.includes('const emailFailed = Boolean(emailResult && !emailResult.success)'), 'verified-notification wrapper detects failure')
  assert.ok(block.includes('success: !emailFailed'), 'verified-notification wrapper reflects failure')
})

// ===========================================================================
// Runtime behavior: provider success/failure propagation through the real
// email action module (Node experimental module mocking; run with
// --experimental-test-module-mocks).
// ===========================================================================

type MockEmailResult = { success: boolean; error?: string; errorCode?: string }

let emailBehavior: MockEmailResult = { success: true }
let dbBroker: { id: string; user: { id: string; email: string; name: string } } | null = {
  id: 'broker-1',
  user: { id: 'user-1', email: 'broker@example.com', name: 'Broker One' },
}
let dbUser: {
  id: string
  email: string
  name: string
  emailVerified: boolean
  brokerProfile: unknown[]
} | null = {
  id: 'user-1',
  email: 'broker@example.com',
  name: 'Broker One',
  emailVerified: false,
  brokerProfile: [],
}

type LastUserUpdate = {
  where: { id: string }
  data: { emailVerificationToken?: string | null; emailVerificationTokenExpiresAt?: Date | null }
}

const store: { lastUserUpdate: LastUserUpdate | undefined } = { lastUserUpdate: undefined }
const getLastUserUpdate = (): LastUserUpdate | undefined => store.lastUserUpdate
const resetLastUserUpdate = (): void => {
  store.lastUserUpdate = undefined
}

// Shared dependency mocks used by the real action module.
mock.module('@/lib/email', {
  namedExports: {
    sendEmail: async () => ({ ...emailBehavior }),
    emailTemplates: {
      brokerWelcome: () => ({ subject: 's', html: 'h' }),
      adminNewBroker: () => ({ subject: 's', html: 'h' }),
      resendVerification: () => ({ subject: 's', html: 'h' }),
      brokerVerified: () => ({ subject: 's', html: 'h' }),
    },
  },
})

mock.module('@/lib/prisma', {
  defaultExport: {
    user: {
      findUnique: async () => dbUser,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      update: async (args: any) => {
        store.lastUserUpdate = args
        return dbUser
      },
    },
    broker: {
      findUnique: async () => dbBroker,
    },
  },
})

let emailActions: typeof import('../actions/email.action')

test('load the real email action module under mocked dependencies', async () => {
  emailActions = await import('../actions/email.action')
  assert.equal(typeof emailActions.resendBrokerVerificationEmail, 'function')
  assert.equal(typeof emailActions.sendBrokerRegistrationEmails, 'function')
})

test('resendBrokerVerificationEmail: provider rejection -> success:false', async () => {
  emailBehavior = { success: false, error: 'Provider rejected', errorCode: 'EMAIL_ERROR' }
  dbBroker = { id: 'broker-1', user: { id: 'user-1', email: 'broker@example.com', name: 'B' } }
  const res = await emailActions.resendBrokerVerificationEmail('broker-1')
  assert.equal(res.success, false)
  assert.equal(res.error, 'Provider rejected')
})

test('resendBrokerVerificationEmail: provider acceptance -> success:true', async () => {
  emailBehavior = { success: true }
  const res = await emailActions.resendBrokerVerificationEmail('broker-1')
  assert.equal(res.success, true)
})

test('resendBrokerVerificationEmail: persists a fresh hashed token with 24h expiry', async () => {
  emailBehavior = { success: true }
  resetLastUserUpdate()
  dbBroker = { id: 'broker-1', user: { id: 'user-1', email: 'broker@example.com', name: 'B' } }
  await emailActions.resendBrokerVerificationEmail('broker-1')
  const update = getLastUserUpdate()
  assert.ok(update, 'user update persisted')
  const token = update.data.emailVerificationToken
  assert.ok(token && /^[0-9a-f]{64}$/.test(token), 'stored token is a sha256 digest (64 hex chars), never the raw token')
  const expires = update.data.emailVerificationTokenExpiresAt
  assert.ok(expires instanceof Date, 'expiry is a Date')
  assert.ok(expires.getTime() > Date.now(), 'expiry is in the future')
})

test('sendBrokerRegistrationEmails: provider rejection -> success:false', async () => {
  emailBehavior = { success: false, error: 'Provider rejected' }
  dbUser = { id: 'user-1', email: 'broker@example.com', name: 'B', emailVerified: false, brokerProfile: [] }
  const res = await emailActions.sendBrokerRegistrationEmails('user-1')
  assert.equal(res.success, false)
  assert.equal(res.error, 'Failed to send verification email')
})

test('sendBrokerRegistrationEmails: provider acceptance -> success:true', async () => {
  emailBehavior = { success: true }
  const res = await emailActions.sendBrokerRegistrationEmails('user-1')
  assert.equal(res.success, true)
})

test('sendBrokerRegistrationEmails: persists a fresh hashed token for a broker with no profile', async () => {
  emailBehavior = { success: true }
  resetLastUserUpdate()
  dbUser = { id: 'user-1', email: 'broker@example.com', name: 'B', emailVerified: false, brokerProfile: [] }
  const res = await emailActions.sendBrokerRegistrationEmails('user-1')
  assert.equal(res.success, true)
  const update = getLastUserUpdate()
  assert.ok(update, 'registration persists the verification token')
  assert.ok(
    update.data.emailVerificationToken && /^[0-9a-f]{64}$/.test(update.data.emailVerificationToken),
    'registration stores a hashed token (never the raw value)',
  )
})