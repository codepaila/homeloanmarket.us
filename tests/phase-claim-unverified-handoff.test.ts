import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

// ===========================================================================
// PHASE — ADMIN_CREATED broker claim: EXISTING UNVERIFIED ACCOUNT HANDOFF
//
// The invited email may already belong to an existing unverified account. The
// claim-aware handoff uses the valid signed claim context + invited recipient
// binding to decide verification is required, then reuses the canonical
// resend-verification endpoint. No new endpoint/token/sender/session system.
// ===========================================================================

const TEST_DIR = path.dirname(new URL(import.meta.url).pathname)
const read = (relative: string): string => fs.readFileSync(path.resolve(TEST_DIR, '..', relative), 'utf8')

const tokenPage = read('app/claim-broker/[token]/page.tsx')
const continuePage = read('app/claim-broker/continue/page.tsx')
const sessionRoute = read('app/api/claims/session/route.ts')
const verifyRoute = read('app/api/auth/verify-email/route.ts')
const resendRoute = read('app/api/auth/resend-verification/route.ts')
const reauthRoute = read('app/api/claims/session/reauth/route.ts')
const completion = read('lib/claim-completion.ts')

// ---------------------------------------------------------------------------
// 1. Claim-aware account lookup (no enumeration, recipient-bound)
// ---------------------------------------------------------------------------

test('claim session exposes the invited account state only when the recipient binding holds', () => {
  assert.match(sessionRoute, /findClaimInvitationByContext\(context\)/)
  assert.match(sessionRoute, /isClaimRecipientMatch\(invitation\.recipientEmail, invitedEmail\)/)
  assert.match(sessionRoute, /accountState/)
  assert.match(sessionRoute, /existing\.emailVerified \? 'verified' : 'unverified'/)
  // Defaults to 'none' and the lookup is inside the invitation-validated branch.
  assert.match(sessionRoute, /let accountState: 'none' \| 'verified' \| 'unverified' = 'none'/)
})

test('claim session rejects invalid/expired/claimed invitations before any account lookup', () => {
  const findIndex = sessionRoute.indexOf('findClaimInvitationByContext(context)')
  const lookupIndex = sessionRoute.indexOf('prisma.user.findUnique')
  assert.ok(findIndex !== -1 && lookupIndex !== -1 && findIndex < lookupIndex, 'invitation validated before account lookup')
  assert.match(sessionRoute, /error instanceof ClaimFlowError && error\.code === 'EXPIRED' \? 410 : 409/)
})

// ---------------------------------------------------------------------------
// 2. Handoff wired into the claim UI, claim-aware only
// ---------------------------------------------------------------------------

test('claim UI routes an existing unverified account to verification via the canonical resend endpoint', () => {
  assert.match(tokenPage, /async function claimNeedsVerification/)
  assert.match(tokenPage, /fetch\('\/api\/claims\/session'\)/)
  assert.match(tokenPage, /data\.accountState === 'unverified'/)
  assert.match(tokenPage, /async function routeToVerification/)
  assert.match(tokenPage, /fetch\('\/api\/auth\/resend-verification'/)
  assert.match(tokenPage, /setMode\('verify'\)/)
})

test('verification is only triggered after the claim-aware check, never on a bare failure', () => {
  const signInBlock = tokenPage.slice(tokenPage.indexOf('async function signInAndClaim'), tokenPage.indexOf('const busy'))
  // Both failure branches gate the resend behind claimNeedsVerification().
  const gates = signInBlock.match(/if \(await claimNeedsVerification\(\)\) \{ await routeToVerification\(\); return \}/g) || []
  assert.equal(gates.length, 2, 'sign-in failure and completion failure both use the claim-aware gate')
  // Generic error remains when the claim-aware check does not confirm unverified.
  assert.match(signInBlock, /setMessage\("We couldn't verify your account\. Please try again\."\)/)
  assert.match(signInBlock, /setMessage\(data\.message \|\| 'Claim could not be completed'\)/)
})

test('verified accounts complete directly without a verification email', () => {
  const signInBlock = tokenPage.slice(tokenPage.indexOf('async function signInAndClaim'), tokenPage.indexOf('const busy'))
  // The resend is only ever reached through the two claim-aware failure gates.
  assert.equal((signInBlock.match(/await routeToVerification\(\)/g) || []).length, 2)
  assert.equal((signInBlock.match(/await claimNeedsVerification\(\)/g) || []).length, 2)
  assert.match(signInBlock, /router\.push\(data\.redirectTo \|\| '\/broker\/subscription\/plan'\)/)
})

// ---------------------------------------------------------------------------
// 3. Reuse of the existing resend architecture (no second endpoint/sender)
// ---------------------------------------------------------------------------

test('resend-verification endpoint is reused unchanged (no new claim resend endpoint)', () => {
  assert.match(resendRoute, /resendVerificationRateLimit\.limit\(/)
  assert.match(resendRoute, /If an account exists with this email, a verification link has been sent/)
  assert.equal(resendRoute.includes('Email is already verified'), false, 'enumeration-resistant')
  // No claim-specific resend route was introduced.
  const claimRoutes = fs.readdirSync(path.resolve(TEST_DIR, '..', 'app/api/claims')).join(',')
  assert.doesNotMatch(claimRoutes, /resend|verify-email/)
})

test('the handoff introduces no second verification-token system or sender', () => {
  assert.doesNotMatch(tokenPage, /sendClaimVerificationEmail|sendUserVerificationEmail|new (Resend|Stripe)|createHash\(/)
  assert.match(tokenPage, /\/api\/auth\/resend-verification/)
})

// ---------------------------------------------------------------------------
// 4. Session continuity / no duplicate password
// ---------------------------------------------------------------------------

test('after verification the session is reused; the password is never requested twice', () => {
  // New claimant: account creation does not sign in.
  const createAccount = tokenPage.slice(tokenPage.indexOf('async function createAccount'), tokenPage.indexOf('async function claimNeedsVerification'))
  assert.doesNotMatch(createAccount, /signIn\(/)
  // Existing unverified: verification establishes the session (verify-email).
  assert.match(verifyRoute, /const claimContext = await getClaimContext\(\)/)
  assert.match(verifyRoute, /signIn\('credentials'/)
  // Continue page reuses the authenticated session without a redundant sign-in.
  assert.match(continuePage, /status === 'authenticated'/)
  const finalize = continuePage.slice(continuePage.indexOf('const finalizeClaim'), continuePage.indexOf('// New-claimant path'))
  assert.doesNotMatch(finalize, /signIn\(/)
})

// ---------------------------------------------------------------------------
// 5. Security invariants preserved
// ---------------------------------------------------------------------------

test('claim completion still requires verification, recipient binding, and atomic attach', () => {
  assert.match(completion, /if \(!user\.emailVerified\) throw new ClaimFlowError\('INELIGIBLE'\)/)
  assert.match(completion, /isClaimRecipientMatch/)
  assert.match(completion, /broker\.updateMany\(\{ where: \{ id: currentInvitation\.claim\.brokerId, userId: null \}, data: \{ userId \} \}\)/)
  assert.match(reauthRoute, /bcrypt\.compare/)
})

test('verification token remains single-use and bound to its account/email', () => {
  assert.match(verifyRoute, /where: \{ id: user\.id, emailVerificationToken: expectedTokenHash \}/)
  assert.match(verifyRoute, /emailChangeTokenHash/)
})

// ---------------------------------------------------------------------------
// 6. Normal auth unchanged / claim Google-free / FREE flow unchanged
// ---------------------------------------------------------------------------

test('normal login and Google auth are unchanged; claim stays Google-free', () => {
  const authConfig = read('lib/auth.config.ts')
  assert.match(authConfig, /GoogleProvider/)
  assert.doesNotMatch(authConfig, /allowDangerousEmailAccountLinking:\s*true/)
  assert.match(read('components/auth/GoogleContinueButton.tsx'), /signIn\('google'/)
  assert.doesNotMatch(tokenPage, /GoogleContinueButton|signIn\('google'|provider=google/)
  assert.doesNotMatch(continuePage, /GoogleContinueButton|signIn\('google'|provider=google/)
})

test('post-claim redirect and FREE/plan flow remain unchanged', () => {
  const completeRoute = read('app/api/claims/session/complete/route.ts')
  assert.match(completeRoute, /redirectTo: '\/broker\/subscription\/plan'/)
  assert.doesNotMatch(completeRoute, /stripe|Stripe/)
})
