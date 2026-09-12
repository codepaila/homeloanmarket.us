import { mock, test } from 'node:test'
import assert from 'node:assert/strict'
import { emailTemplates as realTemplates } from '../lib/email-templates'

// ===========================================================================
// Runtime proof that the admin claim-success notification reaches every
// configured admin and is safe when none are configured.
// Run with: node --test --experimental-test-module-mocks --import tsx
// ===========================================================================

type SendCall = { to: string | string[]; subject: string; html: string; idempotencyKey?: string }

const sent: SendCall[] = []

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

mock.module('@/lib/email', {
  namedExports: {
    sendEmail: async (args: SendCall) => {
      sent.push(args)
      return { success: true, messageId: 'mock_message_id' }
    },
    emailTemplates: realTemplates,
  },
})

let brokerRow: {
  id: string
  displayName: string
  companyName: string | null
  email: string | null
  city: string | null
  profileSlug: string
  user: { email: string } | null
  claim: { completedAt: Date } | null
} | null = null

mock.module('@/lib/prisma', {
  defaultExport: {
    broker: {
      findUnique: async (args: { where: { id: string } }) => {
        if (!brokerRow || brokerRow.id !== args.where.id) return null
        return brokerRow
      },
    },
  },
})

let emailActions: typeof import('../actions/email.action')

test('load the real email action module under mocked dependencies', async () => {
  emailActions = await import('../actions/email.action')
  assert.equal(typeof emailActions.sendAdminBrokerClaimedNotification, 'function')
})

const TWO_ADMINS = ['admin1@example.com', 'admin2@example.com']

test('successful claim delivers the admin notification to every configured admin', async () => {
  sent.length = 0
  platformEnv.adminEmails = TWO_ADMINS
  brokerRow = {
    id: 'broker-1',
    displayName: 'Jane Mortgage',
    companyName: 'Acme Loans',
    email: 'jane@example.com',
    city: 'Austin',
    profileSlug: 'acme-loans',
    user: { email: 'jane@example.com' },
    claim: { completedAt: new Date('2026-02-01T12:00:00Z') },
  }

  const result = await emailActions.sendAdminBrokerClaimedNotification('broker-1')

  assert.equal(result.success, true)
  assert.equal(sent.length, 1)
  assert.deepEqual(sent[0].to, TWO_ADMINS, 'both admins receive the notification')
  assert.match(sent[0].subject, /Broker profile claimed: Jane Mortgage/)
  assert.match(sent[0].html, /Jane Mortgage/)
  assert.match(sent[0].html, /Acme Loans/)
  assert.match(sent[0].html, /jane@example\.com/)
  assert.match(sent[0].idempotencyKey || '', /^admin_broker_claimed_broker-1$/, 'deterministic per-broker key')
})

test('the notification never contains tokens, passwords, or payment secrets', async () => {
  sent.length = 0
  platformEnv.adminEmails = TWO_ADMINS
  const result = await emailActions.sendAdminBrokerClaimedNotification('broker-1')
  assert.equal(result.success, true)
  for (const forbidden of ['password', 'token', 'secret', 'sk_live', 'cvv', 'invitation']) {
    assert.doesNotMatch(sent[0].html, new RegExp(forbidden, 'i'), `email must not contain ${forbidden}`)
  }
})

test('empty ADMIN_EMAILS is a safe no-op (no throw, no send)', async () => {
  sent.length = 0
  platformEnv.adminEmails = []
  const result = await emailActions.sendAdminBrokerClaimedNotification('broker-1')
  assert.equal((result as { skipped?: boolean }).skipped, true)
  assert.equal(sent.length, 0)
})

test('missing broker fails cleanly without sending and without throwing', async () => {
  sent.length = 0
  platformEnv.adminEmails = TWO_ADMINS
  const previous = brokerRow
  brokerRow = null
  const result = await emailActions.sendAdminBrokerClaimedNotification('does-not-exist')
  assert.equal(result.success, false)
  assert.equal(sent.length, 0)
  brokerRow = previous
})
