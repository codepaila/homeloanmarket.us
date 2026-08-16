import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const authConfig = fs.readFileSync('lib/auth.config.ts', 'utf8')
const claimCompletion = fs.readFileSync('lib/claim-completion.ts', 'utf8')

test('Google user creation marks the account as email verified', () => {
  assert.match(authConfig, /role: "USER"/)
  assert.match(authConfig, /emailVerified: true/)
})

test('Google sign-in links the OAuth Account to the newly created user', () => {
  assert.match(authConfig, /prisma\.account\s*\.create\(/)
  assert.match(authConfig, /provider: "google"/)
  assert.match(authConfig, /providerAccountId: account\.providerAccountId/)
  assert.match(authConfig, /userId: created\.id/)
})

test('Google account linking never reassigns an existing account', () => {
  assert.match(authConfig, /error\?\.code !== "P2002"/)
  assert.doesNotMatch(authConfig, /update: \{ userId/)
  assert.doesNotMatch(authConfig, /allowDangerousEmailAccountLinking/)
})

test('existing user (by email) is not duplicated on Google sign-in', () => {
  assert.match(authConfig, /prisma\.user\.findUnique\(\{\s*where: \{ email: user\.email \}/)
  assert.match(authConfig, /if \(!existingUser\)/)
})

test('claim completion still attaches userId to the existing Broker (no create)', () => {
  assert.match(claimCompletion, /updateMany\(\{ where: \{ id: currentInvitation\.claim\.brokerId, userId: null \}, data: \{ userId \} \}/)
  assert.doesNotMatch(claimCompletion, /broker\.create/)
})
