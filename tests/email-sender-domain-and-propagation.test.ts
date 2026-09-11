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
  // Env resolution is centralized in lib/platform-config.ts; lib/email.ts
  // composes the Resend sender from that config.
  const email = read('lib/email.ts')
  const platformConfig = read('lib/platform-config.ts')
  assert.match(platformConfig, /EMAIL_FROM_NAME \|\| 'HomeLoanMarket'/, 'sender name comes from env')
  assert.match(platformConfig, /process\.env\.EMAIL_FROM \|\| null/, 'sender address comes from env')
  assert.doesNotMatch(email, /noreply@homeloanmarket\.(com|net)/, 'sender address is never hardcoded in lib/email.ts')
  assert.match(email, /\$\{platformConfig\.emailFromName\} <\$\{platformConfig\.emailFrom\}>/, 'sender is composed from platform config')
})

test('lib/email.ts fails clearly when EMAIL_FROM or RESEND_API_KEY is missing', () => {
  const email = read('lib/email.ts')
  assert.match(email, /!platformConfig\.resendApiKey \|\| !platformConfig\.emailFrom \|\| !resend/, 'config guard present')
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
  // Single source of truth for the app URL fallback (lib/platform-config.ts);
  // email actions read it via platformConfig.appUrl and templates never
  // hardcode a domain.
  const platformConfig = read('lib/platform-config.ts')
  const actions = read('actions/email.action.ts')
  const templates = read('lib/email-templates.ts')
  assert.match(platformConfig, /'https:\/\/homeloanmarket\.com'/, 'platform config falls back to .com app URL')
  assert.match(actions, /platformConfig\.appUrl/, 'email actions build URLs from platformConfig.appUrl')
  assert.doesNotMatch(templates, /https:\/\/homeloanmarket\.(com|net)/, 'email templates never hardcode a domain')
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

test('sendBrokerVerifiedEmail is fire-and-forget on the real admin VERIFIED transition', () => {
  // The verified notification moved to lib/broker-verification.ts (Phase 8.36):
  // the DB verification is authoritative, the email is dispatched only on the
  // UNVERIFIED -> VERIFIED transition, and an email failure can never roll the
  // persisted verification back (no success:false propagation path).
  const verificationLib = read('lib/broker-verification.ts')
  assert.match(verificationLib, /export async function sendBrokerVerifiedEmail/, 'canonical verified-notification sender exists')
  assert.match(verificationLib, /idempotencyKey: `broker_verified_\$\{params\.profileSlug\}`/, 'deterministic per-broker idempotency key')
  for (const route of ['app/api/admin/brokers/[id]/route.ts', 'app/api/brokers/[id]/route.ts']) {
    const source = read(route)
    assert.match(source, /wasVerifiedTransition/, `${route} detects the real transition`) 
    assert.match(source, /void sendBrokerVerifiedEmail\(/, `${route} dispatches fire-and-forget`) 
    assert.doesNotMatch(source, /await sendBrokerVerifiedEmail/, `${route} must never block on email delivery`) 
  }
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