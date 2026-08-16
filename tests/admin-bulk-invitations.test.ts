import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { friendlyClaimErrorMessage } from '@/lib/claim-errors'

const read = (path: string) => fs.readFileSync(path, 'utf8')

const bulkApi = read('app/api/admin/brokers/bulk-claim-invitations/route.ts')
const page = read('app/admin/brokers/page.tsx')
const ui = read('app/admin/brokers/AdminBulkInvitations.tsx')

test('error codes map to human-readable admin messages', () => {
  assert.equal(friendlyClaimErrorMessage('INVALID_EMAIL'), 'Recipient email address is invalid.')
  assert.equal(friendlyClaimErrorMessage('RATE_LIMITED'), 'This recipient has reached the invitation limit. Try again later.')
  assert.equal(friendlyClaimErrorMessage('ALREADY_INVITED'), 'An active invitation already exists.')
  assert.equal(friendlyClaimErrorMessage('ALREADY_CLAIMED'), 'This broker has already been claimed.')
  assert.equal(friendlyClaimErrorMessage('EMAIL_DELIVERY_FAILED'), 'The invitation email could not be sent.')
  assert.equal(friendlyClaimErrorMessage('UNKNOWN_CODE'), 'Something went wrong. Please try again.')
})

test('bulk API enforces admin auth, same-origin, and a 1-50 item limit', () => {
  assert.match(bulkApi, /role !== 'ADMIN'/)
  assert.match(bulkApi, /isSameOriginRequest/)
  assert.match(bulkApi, /items\.length > 50/)
})

test('bulk API skips only an active invitation whose email was accepted (retry-aware idempotency)', () => {
  assert.match(bulkApi, /status: 'ACTIVE'/)
  assert.match(bulkApi, /events: \{ orderBy: \{ occurredAt: 'desc' \}, take: 1, select: \{ eventType: true \} \}/)
  assert.match(bulkApi, /eventType === 'SENT'/)
  assert.match(bulkApi, /if \(activeInvitation && emailAccepted\)/)
  assert.match(bulkApi, /status: 'SKIPPED'/)
})

test('bulk API processes each item independently and reports per-broker results', () => {
  assert.match(bulkApi, /for \(const item of items\)/)
  assert.doesNotMatch(bulkApi, /Promise\.all\(items/)
  assert.match(bulkApi, /results\.push\(\{ brokerId, brokerName, recipientEmail, status:/)
  assert.match(bulkApi, /email\.success/)
})

test('bulk API result status distinguishes accepted from failed email delivery', () => {
  assert.match(bulkApi, /EMAIL_DELIVERY_FAILED/)
  assert.match(bulkApi, /status: 'SENT', invitationId: result\.invitationId/)
})

test('bulk API returns a batch summary and per-row results without raw tokens', () => {
  assert.match(bulkApi, /summary = \{/)
  assert.match(bulkApi, /sent:|failed:|skipped:/)
  assert.match(bulkApi, /brokerName/)
  assert.doesNotMatch(bulkApi, /claimLink/)
})

test('broker page exposes summary metrics and server-side filters', () => {
  assert.match(page, /Total Brokers/)
  assert.match(page, /Invitations Pending/)
  assert.match(page, /Invitations Accepted/)
  assert.match(page, /prisma\.broker\.count/)
  assert.match(page, /invitation/)
  assert.match(page, /creationSource = filters\.source/)
})

test('broker page paginates server-side and preserves filters', () => {
  assert.match(page, /skip: \(page - 1\) \* PAGE_SIZE/)
  assert.match(page, /take: PAGE_SIZE/)
  assert.match(page, /pageQuery\(filters, page - 1\)/)
})

test('bulk UI supports selection, review, confirm, results, and retry-failed', () => {
  assert.match(ui, /selectedBrokers\.length/)
  assert.match(ui, /Send Invitations/)
  assert.match(ui, /Send broker invitations\?/)
  assert.match(ui, /Recipient email required/)
  assert.match(ui, /Retry failed/)
  assert.match(ui, /status === 'FAILED'/)
  assert.match(ui, /result\.errorMessage/)
})

test('bulk UI only allows eligible unowned non-suspended admin-created brokers', () => {
  assert.match(ui, /userId === null && broker\.creationSource === 'ADMIN_CREATED' && broker\.brokerStatus !== 'SUSPENDED'/)
})

test('bulk UI never exposes raw tokens or internal error codes', () => {
  assert.doesNotMatch(ui, /rawToken/)
  assert.doesNotMatch(ui, /P2002/)
})

test('bulk UI distinguishes email accepted from delivered and only retries failed', () => {
  assert.match(ui, /Invitation email accepted/)
  assert.match(ui, /accepted by the email provider/)
  assert.match(ui, /results\.filter\(\(result\) => result\.status === 'FAILED'\)/)
  assert.doesNotMatch(ui, /delivered/)
})
