import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

// ===========================================================================
// PHASE — ADMIN_CREATED broker claim: PASSWORD-ONLY authentication hardening
//
// The claim flow must authenticate with a password only. Google/OAuth must not
// be offered, invoked, or required anywhere in the claim flow, while normal
// Google login elsewhere must remain unchanged.
// ===========================================================================

const TEST_DIR = path.dirname(new URL(import.meta.url).pathname)
const read = (relative: string): string => fs.readFileSync(path.resolve(TEST_DIR, '..', relative), 'utf8')

const claimTokenPage = read('app/claim-broker/[token]/page.tsx')
const claimContinuePage = read('app/claim-broker/continue/page.tsx')
const reauthRoute = read('app/api/claims/session/reauth/route.ts')
const completion = read('lib/claim-completion.ts')
const claimSetup = read('app/api/auth/claim-setup/route.ts')
const verifyEmailRoute = read('app/api/auth/verify-email/route.ts')
const googleButton = read('components/auth/GoogleContinueButton.tsx')

// ---------------------------------------------------------------------------
// D — Google must not be available in the claim flow
// ---------------------------------------------------------------------------

test('claim token page never imports or renders a Google option', () => {
  assert.doesNotMatch(claimTokenPage, /GoogleContinueButton/)
  assert.doesNotMatch(claimTokenPage, /signIn\('google'/)
  assert.doesNotMatch(claimTokenPage, /provider=google|provider: 'google'/)
})

test('claim continue page never imports or renders a Google option', () => {
  assert.doesNotMatch(claimContinuePage, /GoogleContinueButton/)
  assert.doesNotMatch(claimContinuePage, /signIn\('google'/)
  assert.doesNotMatch(claimContinuePage, /provider=google|provider: 'google'/)
})

test('claim reauth route is credentials-only (no Google provider branch)', () => {
  assert.doesNotMatch(reauthRoute, /provider === 'google'|provider: 'google'|accounts\.some/)
  assert.match(reauthRoute, /bcrypt\.compare/)
  assert.match(reauthRoute, /reauthenticatedVia: 'credentials'/)
})

test('claim completion requires a verified email and has no Google bypass', () => {
  assert.doesNotMatch(completion, /googleReauthenticated|reauthenticatedVia === 'google'/)
  assert.match(completion, /if \(!user\.emailVerified\) throw new ClaimFlowError\('INELIGIBLE'\)/)
})

// ---------------------------------------------------------------------------
// A/B/C — Password-only authentication paths
// ---------------------------------------------------------------------------

test('claim pages authenticate with credentials and the canonical claim endpoints', () => {
  for (const [name, page] of [['[token]', claimTokenPage], ['continue', claimContinuePage]] as const) {
    assert.match(page, /signIn\('credentials'/, `${name}: password sign-in is used`)
    assert.match(page, /\/api\/claims\/session\/reauth/, `${name}: reauthentication boundary is used`)
    assert.match(page, /\/api\/claims\/session\/complete/, `${name}: canonical completion is used`)
  }
})

test('claim account setup creates only a User and preserves the claim context', () => {
  assert.match(claimSetup, /prisma\.user\.create/)
  assert.match(claimSetup, /role: 'BROKER'/)
  assert.match(claimSetup, /emailVerified: false/)
  assert.doesNotMatch(
    claimSetup,
    /broker\.create|brokerRegistration\.create|brokerSubscription\.create|company\.create|companyMembership\.create/,
    'claim account creation must not create Broker/Registration/Subscription/Company records',
  )
  assert.match(claimSetup, /sendClaimVerificationEmail/)
})

test('verify-email returns claim users to the claim continue page (context preserved)', () => {
  assert.match(verifyEmailRoute, /claimContext/)
  assert.match(verifyEmailRoute, /'\/claim-broker\/continue'/)
})

// ---------------------------------------------------------------------------
// I/J — Completion + redirect
// ---------------------------------------------------------------------------

test('both claim pages fall back to /broker/subscription/plan and never the dashboard', () => {
  for (const [name, page] of [['[token]', claimTokenPage], ['continue', claimContinuePage]] as const) {
    assert.match(page, /data\.redirectTo \|\| '\/broker\/subscription\/plan'/, `${name}: canonical post-claim redirect`)
    assert.doesNotMatch(page, /data\.redirectTo \|\| '\/broker\/dashboard'/, `${name}: must not fall back to the dashboard`)
  }
})

test('claim attaches ownership atomically to the existing ADMIN_CREATED Broker', () => {
  assert.match(completion, /broker\.updateMany\(\{ where: \{ id: currentInvitation\.claim\.brokerId, userId: null \}, data: \{ userId \} \}\)/)
  assert.doesNotMatch(completion, /broker\.create/)
  assert.doesNotMatch(completion, /brokerSubscription\.(create|update|upsert|delete)/)
})

// ---------------------------------------------------------------------------
// E/H — Normal Google login must remain available and unchanged
// ---------------------------------------------------------------------------

test('normal login/registration still expose Google (claim-only restriction)', () => {
  assert.match(googleButton, /signIn\('google'/, 'the shared Google component is unchanged')
  for (const page of [
    'app/(public)/auth/signin/page.tsx',
    'app/(public)/register/page.tsx',
    'app/(public)/company/register/CompanyRegisterForm.tsx',
  ]) {
    assert.match(read(page), /GoogleContinueButton/, `${page}: normal Google login remains available`)
  }
  const authConfig = read('lib/auth.config.ts')
  assert.match(authConfig, /GoogleProvider/, 'Google provider is still configured for normal auth')
})

test('dangerous email account linking is not enabled', () => {
  const authConfig = read('lib/auth.config.ts')
  assert.doesNotMatch(authConfig, /allowDangerousEmailAccountLinking:\s*true/)
  assert.doesNotMatch(googleButton, /allowDangerousEmailAccountLinking/)
})

// ---------------------------------------------------------------------------
// Obsolete Google claim state must be removed
// ---------------------------------------------------------------------------

test('obsolete Google claim state is removed', () => {
  const claimContext = read('lib/claim-context.ts')
  const claimFlow = read('lib/claim-flow.ts')
  assert.match(claimContext, /reauthenticatedVia\?: 'credentials'/, 'claim reauth type is credentials-only')
  assert.doesNotMatch(claimContext, /'google'/, 'no google value remains in the claim context type')
  assert.doesNotMatch(claimFlow, /GOOGLE_ONLY|provider === 'google'|accounts\.some/, 'no Google claim classification remains')
})
