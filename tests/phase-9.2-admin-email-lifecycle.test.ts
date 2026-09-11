import { mock, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const TEST_DIR = path.dirname(new URL(import.meta.url).pathname)
const read = (relative: string): string => fs.readFileSync(path.resolve(TEST_DIR, '..', relative), 'utf8')

// ===========================================================================
// PHASE 9.2 — ADMIN EMAIL NOTIFICATIONS FOR THE ACCOUNT LIFECYCLE
//
// Static source audits prove the wiring; runtime tests (mock.module, run with
// --experimental-test-module-mocks) prove delivery to BOTH admin recipients and
// the fail-safe/idempotent behavior.
// ===========================================================================

// ---------------------------------------------------------------------------
// 1. Templates exist, render through the shared shell, and carry no secrets
// ---------------------------------------------------------------------------

test('adminAccountDeletion template exists and renders through the shared shell', () => {
  const templates = read('lib/email-templates.ts')
  assert.match(templates, /adminAccountDeletion: \(data: AdminAccountDeletionEmailData\)/)
  assert.match(templates, /renderEmailShell\(/)
  const block = templates.slice(templates.indexOf('adminAccountDeletion: ('), templates.indexOf('companySubscriptionPurchased'))
  assert.match(block, /tone: 'destructive'/, 'deletion is a destructive-tone notification')
  assert.match(block, /'Deleted At': new Date\(data\.deletedAt\)\.toLocaleString\(\)/, 'deleted-at timestamp included')
})

test('admin deletion notification never carries credentials, tokens, or secrets', () => {
  const templates = read('lib/email-templates.ts')
  const block = templates.slice(templates.indexOf('adminAccountDeletion: ('), templates.indexOf('companySubscriptionPurchased'))
  for (const forbidden of ['password', 'token', 'secret', 'AUTH_SECRET', 'session', 'cvv', 'stripeKey', 'resetLink', 'apiKey']) {
    assert.doesNotMatch(block, new RegExp(forbidden, 'i'), `adminAccountDeletion must not reference ${forbidden}`)
  }
})

test('adminNewCompany template exists, renders through the shared shell, and is informational only', () => {
  const templates = read('lib/email-templates.ts')
  assert.match(templates, /adminNewCompany: \(data: AdminNewCompanyEmailData\)/)
  assert.match(templates, /renderEmailShell\(/)
  const block = templates.slice(templates.indexOf('adminNewCompany: ('), templates.indexOf('accountDeletionConfirmation'))
  assert.doesNotMatch(block, /requires verification/i, 'company registration has no approval workflow — informational only')
  assert.doesNotMatch(block, /Action required/i, 'company notification must not imply action required')
})

// ---------------------------------------------------------------------------
// 2. Admin email dispatch is fire-and-forget AFTER the deletion committed and
//    captures identity BEFORE the destructive transaction
// ---------------------------------------------------------------------------

const DELETION_ROUTES: Record<string, string> = {
  'app/api/account/user/route.ts': 'deleteUserAccount',
  'app/api/account/broker/route.ts': 'deleteBrokerAccount',
  'app/api/account/company/route.ts': 'deleteCompanyAccount',
  'app/api/admin/companies/[id]/delete/route.ts': 'deleteCompanyAccount',
  'app/api/admin/brokers/[id]/delete/route.ts': 'deleteBrokerAccount',
}

test('every deletion route dispatches the admin notification fire-and-forget (void, never await)', () => {
  for (const route of Object.keys(DELETION_ROUTES)) {
    const src = read(route)
    assert.match(src, /void sendAdminAccountDeletionNotification\(/, `${route} dispatches fire-and-forget`)
    assert.doesNotMatch(src, /await sendAdminAccountDeletionNotification/, `${route} must never block on email delivery`)
    assert.doesNotMatch(src, /sendAdminAccountDeletionNotification[\s\S]{0,120}sendAdminAccountDeletionNotification\)\s*;/, `${route} must not send the admin notification twice`)
  }
})

test('every deletion route captures identity (email/name/company) BEFORE the deletion transaction and notifies AFTER it', () => {
  for (const [route, serviceCall] of Object.entries(DELETION_ROUTES)) {
    const src = read(route)
    const deleteCall = src.indexOf(`AccountDeletionService.${serviceCall}`)
    const notifyCall = src.indexOf('sendAdminAccountDeletionNotification({')
    assert.ok(deleteCall !== -1, `${route} calls ${serviceCall}`)
    assert.ok(notifyCall > deleteCall, `${route}: notification dispatched AFTER the deletion service call (${notifyCall} > ${deleteCall})`)
  }
})

test('self-service deletion routes still send the user confirmation email (fire-and-forget)', () => {
  for (const route of ['app/api/account/user/route.ts', 'app/api/account/broker/route.ts', 'app/api/account/company/route.ts']) {
    const src = read(route)
    assert.match(src, /void sendAccountDeletionConfirmationEmail\(/, `${route} sends the user confirmation`)
    assert.doesNotMatch(src, /await sendAccountDeletionConfirmationEmail/, `${route} never blocks on the user confirmation`)
  }
})

test('admin-initiated deletion routes send the admin notification but NOT the user confirmation', () => {
  for (const route of ['app/api/admin/companies/[id]/delete/route.ts', 'app/api/admin/brokers/[id]/delete/route.ts']) {
    const src = read(route)
    assert.match(src, /void sendAdminAccountDeletionNotification\(/, `${route} notifies admins`)
    assert.doesNotMatch(src, /sendAccountDeletionConfirmationEmail/, `${route}: admin already aware, no user confirmation`)
  }
})

// ---------------------------------------------------------------------------
// 3. Broker registration admin notification fires at the broker-created moment
// ---------------------------------------------------------------------------

test('sendBrokerRegistrationEmails no longer carries a dead admin trigger', () => {
  const actions = read('actions/email.action.ts')
  const block = actions.slice(
    actions.indexOf('export async function sendBrokerRegistrationEmails'),
    actions.indexOf('export async function sendAdminNewBrokerNotification'),
  )
  assert.doesNotMatch(block, /emailTemplates\.adminNewBroker/, 'registration-time admin gate is removed (profile cannot exist yet)')
  assert.doesNotMatch(block, /adminEmail/, 'no admin email handling remains inside the registration wrapper')
  assert.match(block, /success: brokerEmailResult\.success/, 'broker verification result is still propagated faithfully')
})

test('adminNewBroker fires after finalizeBrokerRegistration via BOTH broker-created paths', () => {
  const wizard = read('app/api/brokers/route.ts')
  assert.match(wizard, /const broker = await createBrokerForExistingUser/, 'wizard finalizes the broker')
  assert.match(wizard, /void sendAdminNewBrokerNotification\(broker\.id\)/, 'wizard dispatches fire-and-forget after creation')
  assert.doesNotMatch(wizard, /await sendAdminNewBrokerNotification/, 'wizard must never block on the admin email')
  assert.ok(
    wizard.indexOf('createBrokerForExistingUser') < wizard.indexOf('sendAdminNewBrokerNotification'),
    'wizard notifies AFTER the broker is created',
  )

  const successPage = read('app/broker-registration/subscription/success/page.tsx')
  assert.match(successPage, /const broker = await finalizeBrokerRegistration\(user\.id\)/, 'success page finalizes and captures the broker')
  assert.match(successPage, /void sendAdminNewBrokerNotification\(broker\.id\)/, 'success page dispatches fire-and-forget after finalization')
})

test('admin new company email fires only on a genuinely fresh registration (alreadyCompany=false)', () => {
  const route = read('app/api/auth/company-intent/route.ts')
  assert.match(route, /if \(!result\.alreadyCompany\)/, 'notification gated on fresh registration only')
  assert.match(route, /void sendAdminNewCompanyNotification\(result\.companyId\)/, 'dispatched fire-and-forget')
  assert.doesNotMatch(route, /await sendAdminNewCompanyNotification/, 'never blocks on the admin email')
})

test('company-intent route does NOT fabricate a user-facing company-created email', () => {
  const route = read('app/api/auth/company-intent/route.ts')
  assert.doesNotMatch(route, /sendEmail/, 'no owner-facing registration email exists today; nothing invented')
})

// ---------------------------------------------------------------------------
// 4. Canonical helper / multi-recipient / idempotency wiring in the actions
// ---------------------------------------------------------------------------

test('admin notifications target ALL configured ADMIN_EMAILS and use deterministic idempotency keys', () => {
  const actions = read('actions/email.action.ts')
  const adminEmailTargets = actions.match(/to: platformConfig\.adminEmails/g) || []
  assert.ok(adminEmailTargets.length >= 3, 'deletion + new-broker + new-company notifications all send to every admin')
  assert.match(actions, /idempotencyKey: `admin_account_deleted_\$\{params\.email\}_\$\{params\.accountType\.toLowerCase\(\)\}`/, 'deletion key is deterministic per account')
  assert.match(actions, /idempotencyKey: `admin_new_broker_\$\{broker\.id\}`/, 'new-broker key is deterministic per broker')
  assert.match(actions, /idempotencyKey: `admin_new_company_\$\{company\.id\}`/, 'new-company key is deterministic per company')
})

test('admin notifications skip safely when ADMIN_EMAILS is empty', () => {
  const actions = read('actions/email.action.ts')
  const blocks = actions.match(/platformConfig\.adminEmails\.length === 0/g) || []
  assert.ok(blocks.length >= 3, 'every admin notification guards against missing ADMIN_EMAILS')
})

test('ADMIN_EMAILS is never exposed to the browser: only the canonical server helper reads the env', () => {
  const envRead = /process\.env\.ADMIN_EMAIL/
  const offenders: string[] = []
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(abs)
      else if (/\.tsx?$/.test(entry.name) && !abs.endsWith('.d.ts')) {
        const src = fs.readFileSync(abs, 'utf8')
        if (envRead.test(src) && !abs.endsWith('lib/platform-config.ts')) offenders.push(abs)
      }
    }
  }
  for (const dir of ['lib', 'app', 'actions', 'components']) walk(dir)
  assert.deepEqual(offenders, [], `ADMIN_EMAIL env read outside the canonical helper: ${offenders.join(', ')}`)
})

test('one canonical server-side helper exists (parseAdminEmails) with no competing implementations', () => {
  const platformConfig = read('lib/platform-config.ts')
  assert.match(platformConfig, /export function parseAdminEmails\(\)/, 'canonical helper exists')
  assert.match(platformConfig, /process\.env\.ADMIN_EMAILS/, 'reads the modern env var')
  assert.match(platformConfig, /process\.env\.ADMIN_EMAIL\b/, 'reads the legacy env var')
  const actions = read('actions/email.action.ts')
  assert.doesNotMatch(actions, /(\bconst\s+[A-Za-z]+Admin[A-Za-z]*Emails|function\s+[A-Za-z]*[Aa]dmin[A-Za-z]*Emails?\()/, 'actions never re-implement parsing')
  assert.match(actions, /platformConfig\.adminEmails/, 'actions consume the canonical config')
})

test('admin CTA URLs point at real admin destinations', () => {
  const actions = read('actions/email.action.ts')
  assert.match(actions, /admin\/brokers\/\$\{broker\.id\}/, 'new-broker CTA deep-links the admin broker review')
  assert.match(actions, /admin\/companies/, 'new-company CTA targets the admin companies list')
})

// ===========================================================================
// Runtime behavior (run with --experimental-test-module-mocks)
// ===========================================================================

type SendCall = { to: string | string[]; subject: string; html: string; idempotencyKey?: string }

const sent: SendCall[] = []

// Shared platform-config mock (mutable adminEmails) reused by every runtime
// scenario, mirroring the canonical parseAdminEmails() semantics.
const platformEnv = {
  resendApiKey: 'test_key',
  emailFrom: 'noreply@homeloanmarket.com',
  emailFromName: 'HomeLoanMarket',
  supportEmail: null,
  adminEmails: [] as string[],
  emailReplyTo: null,
  emailUnsubscribe: null,
  appUrl: 'https://homeloanmarket.com',
}

mock.module('@/lib/platform-config', {
  namedExports: {
    platformConfig: platformEnv,
    parseAdminEmails: () => platformEnv.adminEmails,
  },
})

// Real templates rendered by the actions under test (from the shared shell).
let emailTemplatesReal: typeof import('../lib/email-templates').emailTemplates
test('load real templates', async () => {
  emailTemplatesReal = (await import('../lib/email-templates')).emailTemplates
  assert.equal(typeof emailTemplatesReal.adminAccountDeletion, 'function')
})

let brokerRow: {
  id: string
  displayName: string
  companyName: string | null
  city: string | null
  experienceYears: number | null
  user: { email: string }
} | null = null

let companyRow: {
  id: string
  name: string
  createdAt: Date
  memberships: Array<{ user: { name: string; email: string } }>
} | null = null

mock.module('@/lib/email', {
  namedExports: {
    sendEmail: async (args: SendCall) => {
      sent.push(args)
      return { success: true, messageId: 'mock_message_id' }
    },
    emailTemplates: new Proxy({}, {
      get: (_, prop) => {
        if (typeof prop === 'symbol') return undefined
        const template = (emailTemplatesReal as unknown as Record<string, unknown>)[prop]
        if (typeof template === 'function') return template
        return undefined
      },
    }),
  },
})

mock.module('@/lib/prisma', {
  defaultExport: {
    broker: {
      findUnique: async (args: { where: { id: string } }) => {
        if (!brokerRow || brokerRow.id !== args.where.id) return null
        return brokerRow
      },
    },
    company: {
      findUnique: async (args: { where: { id: string } }) => {
        if (!companyRow || companyRow.id !== args.where.id) return null
        return companyRow
      },
    },
  },
})

let emailActions: typeof import('../actions/email.action')

test('load the real email action module under mocked dependencies', async () => {
  emailActions = await import('../actions/email.action')
  assert.equal(typeof emailActions.sendAdminAccountDeletionNotification, 'function')
  assert.equal(typeof emailActions.sendAdminNewBrokerNotification, 'function')
  assert.equal(typeof emailActions.sendAdminNewCompanyNotification, 'function')
})

const TWO_ADMINS = ['admin1@example.com', 'admin2@example.com']

test('MATRIX 2/7/11: admin account-deletion notification is delivered to BOTH admins', async () => {
  sent.length = 0
  platformEnv.adminEmails = TWO_ADMINS
  const res = await emailActions.sendAdminAccountDeletionNotification({
    email: 'deleted@example.com',
    name: 'Jane Deleted',
    accountType: 'Broker',
    companyName: 'Acme Loans',
    deletedBy: 'USER',
  })
  assert.equal(res.success, true)
  assert.equal(sent.length, 1)
  assert.deepEqual(sent[0].to, TWO_ADMINS, 'both admin recipients receive the notification')
  assert.match(sent[0].subject, /Account deleted on HomeLoanMarket: Broker/)
  assert.match(sent[0].html, /deleted@example\.com/)
  assert.match(sent[0].html, /Jane Deleted/)
  assert.match(sent[0].html, /Acme Loans/)
  assert.match(sent[0].idempotencyKey || '', /^admin_account_deleted_deleted@example\.com_broker$/)
})

test('MATRIX 17: empty ADMIN_EMAILS -> no admin email is sent; user email still can send', async () => {
  sent.length = 0
  platformEnv.adminEmails = []
  const res = await emailActions.sendAdminAccountDeletionNotification({
    email: 'deleted@example.com',
    name: 'J',
    accountType: 'User',
    deletedBy: 'USER',
  })
  assert.equal((res as { skipped?: boolean }).skipped, true, 'notification skips cleanly when no admins configured')
  assert.equal(sent.length, 0, 'no admin email sent')
})

test('MATRIX 12/14: admin new-broker notification addresses the registered broker and reaches BOTH admins', async () => {
  sent.length = 0
  platformEnv.adminEmails = TWO_ADMINS
  brokerRow = {
    id: 'broker-1',
    displayName: 'Jane Mortgage',
    companyName: 'Acme Loans',
    city: 'Austin',
    experienceYears: 8,
    user: { email: 'jane@example.com' },
  }
  const res = await emailActions.sendAdminNewBrokerNotification('broker-1')
  assert.equal(res.success, true)
  assert.equal(sent.length, 1)
  assert.deepEqual(sent[0].to, TWO_ADMINS)
  assert.match(sent[0].subject, /New broker registration: Jane Mortgage/, 'email content addresses the registered broker, not the admin')
  assert.match(sent[0].html, /jane@example\.com/)
  assert.match(sent[0].idempotencyKey || '', /^admin_new_broker_broker-1$/)
})

test('admin new-broker notification fails cleanly when the broker no longer exists', async () => {
  sent.length = 0
  brokerRow = null
  const res = await emailActions.sendAdminNewBrokerNotification('broker-1')
  assert.equal(res.success, false)
  assert.equal(sent.length, 0)
})

test('MATRIX 16: admin new-company notification reaches BOTH admins', async () => {
  sent.length = 0
  platformEnv.adminEmails = TWO_ADMINS
  companyRow = { id: 'company-1', name: 'Acme Advertising', createdAt: new Date('2026-01-01T00:00:00Z'), memberships: [{ user: { name: 'Bob Owner', email: 'bob@example.com' } }] }
  const res = await emailActions.sendAdminNewCompanyNotification('company-1')
  assert.equal(res.success, true)
  assert.equal(sent.length, 1)
  assert.deepEqual(sent[0].to, TWO_ADMINS)
  assert.match(sent[0].subject, /New company registered: Acme Advertising/)
  assert.match(sent[0].html, /bob@example\.com/)
  assert.match(sent[0].idempotencyKey || '', /^admin_new_company_company-1$/)
})

// Canonical ADMIN_EMAILS parsing semantics (matrix 14/17 + edge cases) are
// covered in tests/phase-9.2-admin-email-config.test.ts (mock-free import of the
// real lib/platform-config module).
// Real-sender idempotency (matrix 1/4/6/9 — duplicate suppression + multi
// recipient delivery through the actual Resend boundary) is covered in
// tests/phase-9.2-admin-email-dedupe.test.ts (its own mock of 'resend').