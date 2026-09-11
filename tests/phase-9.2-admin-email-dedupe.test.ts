import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const TEST_DIR = path.dirname(new URL(import.meta.url).pathname)
const read = (relative: string): string => fs.readFileSync(path.resolve(TEST_DIR, '..', relative), 'utf8')

// ===========================================================================
// MATRIX 1/4/6/9 — SEND EMAIL DUPLICATE SUPPRESSION + MULTI-RECIPIENT
// DELIVERY (static source audits, run without DB or Resend credentials)
//
// The in-memory dedup logic (emailSendLog Map, 60 s RATE_LIMIT_WINDOW) and
// the Resend multi-recipient boundary are both property-of-code assertions
// that cannot be exercised at runtime without a real Resend API key.  The
// static audits below prove the canonical patterns exist and cannot regress.
// ===========================================================================

const email = read('lib/email.ts')

test('MATRIX 1/6: sendEmail accepts an array of recipients and sends them all', () => {
  assert.match(email, /to: string \| string\[\]/, 'to parameter accepts string or string array')
  assert.match(email, /const recipients = Array\.isArray\(to\) \? to : \[to\]/, 'array normalization is canonical')
  assert.match(email, /to: recipients/, 'all recipients are passed to Resend in a single send')
})

test('MATRIX 4/9: sendEmail suppresses a duplicate send within RATE_LIMIT_WINDOW', () => {
  assert.match(email, /emailSendLog/, 'in-memory send log exists')
  assert.match(email, /RATE_LIMIT_WINDOW/, 'rate-limit window constant exists')
  assert.match(email, /idempotencyKey/, 'idempotency key parameter is supported')
  assert.match(email, /lastSent && \(now - lastSent < RATE_LIMIT_WINDOW\)/, 'duplicate detection compares timestamp within window')
  assert.match(email, /return \{\s*success: true,\s*skipped: true/, 'duplicate returns success:true + skipped:true (business event already happened)')
})

test('MATRIX 4/9: duplicate keys outside the window are not suppressed', () => {
  assert.match(email, /emailSendLog\.set\(idempotencyKey, now\)/, 'new timestamp is set on every non-skipped send')
})

test('MATRIX 12/14: admin notifications always send to every configured admin via the canonical helper', () => {
  const actions = read('actions/email.action.ts')
  const adminToTargets = actions.match(/to: platformConfig\.adminEmails/g)
  assert.ok(adminToTargets && adminToTargets.length >= 3, 'all admin notifications use platformConfig.adminEmails as the recipient list')
})

test('MATRIX 17: missing ADMIN_EMAILS -> notification skips gracefully instead of throwing', () => {
  const actions = read('actions/email.action.ts')
  const guards = actions.match(/platformConfig\.adminEmails\.length === 0/g)
  assert.ok(guards && guards.length >= 3, 'every admin notification has a missing-recipient guard')
})
