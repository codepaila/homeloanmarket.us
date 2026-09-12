import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { emailTemplates } from '../lib/email-templates'

const TEST_DIR = path.dirname(new URL(import.meta.url).pathname)
const read = (relative: string): string => fs.readFileSync(path.resolve(TEST_DIR, '..', relative), 'utf8')

// ===========================================================================
// PHASE — EMAIL CUSTOMER-FACING TERMINOLOGY: BROKER → MORTGAGE ORIGINATOR
//
// Customer-facing email copy must say "Mortgage Originator". Internal code and
// domain identifiers (Prisma models, types, functions, metadata keys, routes)
// remain unchanged. Locked claim-invitation copy is not modified.
// ===========================================================================

// ---------------------------------------------------------------------------
// 1. Rendered customer-facing templates
// ---------------------------------------------------------------------------

test('brokerVerified email uses Mortgage Originator terminology', () => {
  const result = emailTemplates.brokerVerified({
    displayName: 'Jane Doe',
    profileUrl: 'https://homeloanmarket.com/brokers/jane',
    dashboardUrl: 'https://homeloanmarket.com/broker/dashboard',
    city: 'Austin',
    experienceYears: 8,
  })
  assert.match(result.subject, /mortgage originator account is verified/i)
  assert.match(result.html, /mortgage originator account/i)
  assert.match(result.html, /public mortgage originator directory/i)
  assert.doesNotMatch(result.html, /broker account/i)
  assert.doesNotMatch(result.html, /public broker directory/i)
})

test('accountDeletionConfirmation renders the Broker account type as Mortgage Originator', () => {
  const result = emailTemplates.accountDeletionConfirmation({
    name: 'John Smith',
    accountType: 'Broker',
    deletedAt: new Date('2026-02-01T12:00:00Z'),
  })
  assert.match(result.subject, /Mortgage Originator account has been deleted/)
  assert.match(result.html, /mortgage originator account/i)
  assert.doesNotMatch(result.subject, /Broker/)
  assert.doesNotMatch(result.html, /broker account/i)
})

test('accountDeletionConfirmation still renders User and Company account types unchanged', () => {
  const user = emailTemplates.accountDeletionConfirmation({ name: 'U', accountType: 'User', deletedAt: new Date() })
  const company = emailTemplates.accountDeletionConfirmation({ name: 'C', accountType: 'Company', deletedAt: new Date() })
  assert.match(user.subject, /User account has been deleted/)
  assert.match(company.subject, /Company account has been deleted/)
})

test('contactMessageConfirmation labels the professional as Mortgage Originator', () => {
  const result = emailTemplates.contactMessageConfirmation({
    recipientName: 'Bob',
    brokerName: 'Acme Mortgage',
    companyName: 'Acme',
    sentAt: new Date('2026-02-01T12:00:00Z'),
  })
  assert.match(result.html, /Mortgage Originator/)
  assert.doesNotMatch(result.html, /Broker/)
})

test('paymentFailure subscription email product label is Mortgage Originator', () => {
  const result = emailTemplates.paymentFailure('Jane', 'Mortgage Originator', 'https://homeloanmarket.com/broker/subscription/billing')
  assert.match(result.subject, /Payment failure for your Mortgage Originator subscription/)
  assert.doesNotMatch(result.subject, /Broker/)
})

// ---------------------------------------------------------------------------
// 2. Senders pass customer-facing terminology (static wiring)
// ---------------------------------------------------------------------------

test('broker verification sender text uses mortgage originator terminology', () => {
  const source = read('lib/broker-verification.ts')
  assert.match(source, /mortgage originator account is verified/)
  assert.doesNotMatch(source, /broker account is verified/)
})

test('broker payment-failure sender passes the Mortgage Originator product label', () => {
  const source = read('lib/broker-payment-failure-email.ts')
  const call = source.slice(source.indexOf('emailTemplates.paymentFailure('), source.indexOf('paymentFailure(') + 200)
  assert.match(call, /'Mortgage Originator'/)
  assert.doesNotMatch(call, /'Broker'/)
})

test('customer email greeting fallbacks never use "Broker" as a name', () => {
  const actions = read('actions/email.action.ts')
  assert.doesNotMatch(actions, /user\.name \|\| 'Broker'/)
  assert.doesNotMatch(actions, /broker\.user\.name \|\| 'Broker'/)
  assert.match(actions, /user\.name \|\| 'there'/)
})

// ---------------------------------------------------------------------------
// 3. Internal identifiers intentionally preserved
// ---------------------------------------------------------------------------

test('internal broker identifiers are preserved (no schema/type/function renames)', () => {
  const templates = read('lib/email-templates.ts')
  const actions = read('actions/email.action.ts')
  const paymentFailure = read('lib/broker-payment-failure-email.ts')
  const verification = read('lib/broker-verification.ts')
  const schema = read('prisma/schema.prisma')

  // Template names / data contracts are internal identifiers.
  assert.match(templates, /brokerVerified: \(data: BrokerVerifiedEmailData\)/)
  assert.match(templates, /brokerName: string/)
  assert.match(templates, /AdminBrokerClaimedEmailData/)
  assert.match(templates, /adminNewBroker: \(data: AdminNewBrokerEmailData\)/)

  // Sender functions and durable idempotency keys are internal identifiers.
  assert.match(actions, /export async function sendAdminNewBrokerNotification/)
  assert.match(actions, /export async function sendAdminBrokerClaimedNotification/)
  assert.match(verification, /export async function sendBrokerVerifiedEmail/)
  assert.match(verification, /idempotencyKey: `broker_verified_\$\{params\.profileSlug\}`/)
  assert.match(paymentFailure, /payment_failure_broker_\$\{brokerSubscriptionId\}_\$\{invoiceId\}/)

  // Prisma models/fields are untouched.
  assert.match(schema, /model Broker \{/)
  assert.match(schema, /model BrokerSubscription \{/)
})

// ---------------------------------------------------------------------------
// 4. Locked / separately-approved terminology is not modified
// ---------------------------------------------------------------------------

test('locked claim invitation copy still uses "mortgage professional"', () => {
  const templates = read('lib/email-templates.ts')
  const block = templates.slice(templates.indexOf('claimInvitation: ('), templates.indexOf('claimVerification: ('))
  assert.match(block, /mortgage professional profile is now listed/)
  assert.doesNotMatch(block, /Mortgage Originator account/)
})

test('admin-facing notifications are intentionally retained (not customer-facing)', () => {
  const templates = read('lib/email-templates.ts')
  const adminNewBroker = templates.slice(templates.indexOf('adminNewBroker: ('), templates.indexOf('adminNewCompany: ('))
  assert.match(adminNewBroker, /New broker registration/)
  const adminClaimed = templates.slice(templates.indexOf('adminBrokerClaimed: ('), templates.indexOf('export function htmlToText'))
  assert.match(adminClaimed, /Broker profile claimed/)
})
