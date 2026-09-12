import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

// ===========================================================================
// PHASE — ADMIN_CREATED broker claim: SESSION CONTINUITY
//
// The claimant enters the password ONCE (account creation). Email verification
// establishes the authenticated Auth.js session using the same single-use
// verification-token mechanism as broker registration, and /claim-broker/continue
// reuses that session instead of asking for the password again. No claim
// security check is weakened.
// ===========================================================================

const TEST_DIR = path.dirname(new URL(import.meta.url).pathname)
const read = (relative: string): string => fs.readFileSync(path.resolve(TEST_DIR, '..', relative), 'utf8')

const tokenPage = read('app/claim-broker/[token]/page.tsx')
const continuePage = read('app/claim-broker/continue/page.tsx')
const verifyRoute = read('app/api/auth/verify-email/route.ts')
const claimSetup = read('app/api/auth/claim-setup/route.ts')
const emailRoute = read('app/api/claims/session/email/route.ts')
const reauthRoute = read('app/api/claims/session/reauth/route.ts')
const completeRoute = read('app/api/claims/session/complete/route.ts')
const completion = read('lib/claim-completion.ts')

// ---------------------------------------------------------------------------
// 1. NEW CLAIMANT — password once, session established at verification
// ---------------------------------------------------------------------------

test('new claimant: account creation does not sign in (password entered once)', () => {
  assert.match(claimSetup, /prisma\.user\.create/)
  assert.doesNotMatch(claimSetup, /signIn\(/)
  assert.match(tokenPage, /fetch\('\/api\/auth\/claim-setup'/)
  const createAccount = tokenPage.slice(tokenPage.indexOf('async function createAccount'), tokenPage.indexOf('async function signInAndClaim'))
  assert.doesNotMatch(createAccount, /signIn\(/, 'creating the account must not trigger a password sign-in')
})

test('new claimant: email verification establishes the authenticated claim session', () => {
  assert.match(verifyRoute, /const claimContext = await getClaimContext\(\)/)
  assert.match(verifyRoute, /const preserveTokenForSignIn = isBrokerRegistration \|\| Boolean\(claimContext\)/)
  assert.match(verifyRoute, /if \(preserveTokenForSignIn\)/)
  assert.match(verifyRoute, /redirectTo: claimContext \? '\/claim-broker\/continue' : '\/setup'/)
  assert.match(verifyRoute, /await setClaimContext\(\{/)
  assert.match(verifyRoute, /reauthenticatedAt: Date\.now\(\)/)
})

test('new claimant: the continue page auto-completes from the session without signing in', () => {
  assert.match(continuePage, /status === 'authenticated'/)
  // The finalize path (used by the auto-complete effect) never calls signIn.
  const finalize = continuePage.slice(continuePage.indexOf('const finalizeClaim'), continuePage.indexOf('// New-claimant path'))
  assert.match(finalize, /\/api\/claims\/session\/complete/)
  assert.doesNotMatch(finalize, /signIn\(/)
  // signIn only exists in the explicit fallback form
  const completeFn = continuePage.slice(continuePage.indexOf('async function complete'), continuePage.indexOf('const completing'))
  assert.match(completeFn, /signIn\('credentials'/)
})

// ---------------------------------------------------------------------------
// 2. EXISTING VERIFIED ACCOUNT — password once, no duplicate login
// ---------------------------------------------------------------------------

test('existing verified account: password is used once (signIn + reauth), no duplicate login', () => {
  const signInAndClaim = tokenPage.slice(tokenPage.indexOf('async function signInAndClaim'), tokenPage.indexOf('const busy'))
  assert.equal((signInAndClaim.match(/signIn\('credentials'/g) || []).length, 1, 'exactly one password sign-in')
  assert.match(signInAndClaim, /\/api\/claims\/session\/reauth/)
  assert.match(signInAndClaim, /\/api\/claims\/session\/complete/)
})

// ---------------------------------------------------------------------------
// 3. SECURITY INVARIANTS PRESERVED
// ---------------------------------------------------------------------------

test('claim completion still requires a verified email and recipient binding', () => {
  assert.match(completion, /if \(!user\.emailVerified\) throw new ClaimFlowError\('INELIGIBLE'\)/)
  assert.match(completion, /isClaimRecipientMatch/)
  assert.match(completion, /broker\.updateMany\(\{ where: \{ id: currentInvitation\.claim\.brokerId, userId: null \}, data: \{ userId \} \}\)/)
})

test('claim reauthentication remains password-only', () => {
  assert.match(reauthRoute, /bcrypt\.compare/)
  assert.match(reauthRoute, /user\.email\?\.toLowerCase\(\) !== context\.email\?\.toLowerCase\(\)/)
  assert.match(reauthRoute, /throw new ClaimFlowError\('INELIGIBLE'\)/)
  assert.doesNotMatch(reauthRoute, /provider === 'google'|provider: 'google'|signIn\('google'/)
})

test('email step remains recipient-bound', () => {
  assert.match(emailRoute, /isClaimRecipientMatch/)
})

test('verification token remains single-use and bound to the account', () => {
  assert.match(verifyRoute, /where: \{ id: user\.id, emailVerificationToken: expectedTokenHash \}/)
  assert.match(verifyRoute, /emailChangeTokenHash/)
})

test('expired / consumed / already-owned claims remain rejected at completion', () => {
  assert.match(completion, /currentInvitation\.status === 'USED'/)
  assert.match(completion, /currentInvitation\.status !== 'ACTIVE' \|\| currentInvitation\.expiresAt <= new Date\(\)/)
  assert.match(completion, /attached\.count !== 1/)
})

// ---------------------------------------------------------------------------
// 4. REDIRECT
// ---------------------------------------------------------------------------

test('post-claim redirect remains /broker/subscription/plan (no open redirect)', () => {
  assert.match(completeRoute, /redirectTo: '\/broker\/subscription\/plan'/)
  assert.match(continuePage, /data\.redirectTo \|\| '\/broker\/subscription\/plan'/)
  assert.match(tokenPage, /data\.redirectTo \|\| '\/broker\/subscription\/plan'/)
})

// ---------------------------------------------------------------------------
// 5. NORMAL GOOGLE AUTH UNCHANGED / CLAIM GOOGLE-FREE
// ---------------------------------------------------------------------------

test('normal Google authentication remains unchanged and claim stays Google-free', () => {
  const authConfig = read('lib/auth.config.ts')
  assert.match(authConfig, /GoogleProvider/)
  assert.doesNotMatch(authConfig, /allowDangerousEmailAccountLinking:\s*true/)
  assert.match(read('components/auth/GoogleContinueButton.tsx'), /signIn\('google'/)
  for (const [name, page] of [['[token]', tokenPage], ['continue', continuePage]] as const) {
    assert.doesNotMatch(page, /GoogleContinueButton|signIn\('google'|provider=google/, `${name}: claim stays Google-free`)
  }
})

// ---------------------------------------------------------------------------
// 6. SESSION REFRESH IS NO-ARGUMENT (privilege-escalation hardening)
// ---------------------------------------------------------------------------

test('claim session refresh is always no-argument', () => {
  for (const page of [tokenPage, continuePage]) {
    assert.doesNotMatch(page, /refreshSession\(\{/)
  }
})
