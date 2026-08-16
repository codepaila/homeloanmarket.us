import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')

const actions = read('app/admin/brokers/[id]/AdminBrokerActions.tsx')
const resend = read('app/api/admin/claim-invitations/[id]/resend/route.ts')

test('resend button shows a loading state and is disabled while pending', () => {
  assert.match(actions, /isSending/)
  assert.match(actions, /Sending…/)
  assert.match(actions, /Loader2/)
  assert.match(actions, /aria-busy=\{isSending\}/)
  assert.match(actions, /disabled=\{isSending \|\| !deliveryEmail\}/)
})

test('double-click is guarded so only one resend request is issued', () => {
  assert.match(actions, /if \(isSending\) return/)
})

test('loading state always clears in a finally block', () => {
  assert.match(actions, /finally \{\s*setIsSending\(false\)\s*\}/)
})

test('success toast uses "accepted" wording and is shown once', () => {
  assert.match(actions, /toast\.success\(`Invitation email accepted by the email provider/)
  assert.doesNotMatch(actions, /delivered/)
})

test('email provider failure shows an error toast, not success', () => {
  assert.match(actions, /emailSent === false/)
  assert.match(actions, /toast\.error\('The invitation email could not be sent\.'\)/)
})

test('network/API failure shows an error toast with a fallback message', () => {
  assert.match(actions, /if \(!response\.ok\) \{/)
  assert.match(actions, /toast\.error\(data\.message \|\| 'Unable to resend the invitation\. Please try again\.'\)/)
  assert.match(actions, /catch \{\s*toast\.error\('Unable to resend the invitation\. Please try again\.'\)/)
})

test('resend endpoint returns structured friendly errors via lib/claim-errors', () => {
  assert.match(resend, /friendlyClaimErrorMessage\(error\.code\)/)
  assert.match(resend, /errorCode: error\.code/)
  assert.match(resend, /errorCode: 'UNEXPECTED_ERROR'/)
  assert.match(resend, /No active invitation is available to resend\./)
})

test('resend endpoint never exposes raw tokens in the error path', () => {
  assert.doesNotMatch(resend, /rawToken.*errorCode/)
})
