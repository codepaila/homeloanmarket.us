import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const TEST_DIR = path.dirname(new URL(import.meta.url).pathname)
const read = (relative: string): string => fs.readFileSync(path.resolve(TEST_DIR, '..', relative), 'utf8')

// =============================================================
// 1. Login rate limiting
// =============================================================

test('login: active LoginWithCredential throttles repeated attempts server-side', () => {
  const source = read('actions/auth.action.ts')
  assert.ok(source.includes('loginRateLimit.limit('), 'active login must invoke the limiter')
  assert.ok(source.includes('login:${ip}'), 'limiter keyed by client IP')
  assert.ok(source.includes("Too many login attempts. Please try again later."), 'throttled response is generic')
})

test('login: rate-limit failures fail open (no auth outage when Redis is down)', () => {
  const source = read('actions/auth.action.ts')
  assert.ok(source.includes('fail open'), 'fail-open policy must be documented')
  const catchBlock = source.slice(source.indexOf('loginRateLimit.limit('), source.indexOf('const email = String'))
  assert.ok(catchBlock.includes('catch') && catchBlock.includes('// fail open'), 'limiter errors must not block login')
})

test('login: no account-existence leak (generic error, no pre-limit email enumeration)', () => {
  const source = read('actions/auth.action.ts')
  assert.ok(source.includes('Invalid credentials!'), 'credential failure is generic')
})

test('login: existing rate-limit policy is defined and active in the app', () => {
  const source = read('lib/rateLimit.ts')
  assert.ok(source.includes('brokerLoginRateLimit'), 'brokerLoginRateLimit must exist')
  assert.ok(source.includes('prefix: "ratelimit:broker-login"'), 'login limiter namespace is canonical')
})

// =============================================================
// 2. Forgot-password rate limiting
// =============================================================

test('forgot-password: route throttles reset requests server-side', () => {
  const source = read('app/api/auth/forgot-password/route.ts')
  assert.ok(source.includes('forgotPasswordRateLimit.limit('), 'route must invoke the limiter')
  assert.ok(source.includes('forgot:${ip}'), 'limiter keyed by client IP')
  assert.ok(source.includes('status: 429'), 'throttled response returns 429')
})

test('forgot-password: generic response for unknown accounts is preserved', () => {
  const source = read('app/api/auth/forgot-password/route.ts')
  assert.ok(source.includes('If an account exists with this email, a password reset link has been sent.'), 'generic response preserved')
  assert.equal(source.includes('email does not exist'), false, 'no account-existence leak')
})

test('forgot-password: raw reset token is never logged', () => {
  const source = read('actions/email.action.ts')
  assert.equal(source.includes('Reset URL generated'), false, 'reset URL (contains raw token) must not be logged')
  const forgotSource = read('app/api/auth/forgot-password/route.ts')
  assert.equal(/console\.(log|info)\(.*token/i.test(forgotSource), false, 'forgot route must not log tokens')
})

test('forgot-password: token lifecycle remains secure (hash, expiry, single-use)', () => {
  const resetSource = read('app/api/auth/reset-password/route.ts')
  assert.ok(resetSource.includes("createHash('sha256')"), 'token hashed before comparison')
  assert.ok(resetSource.includes('resetPasswordTokenExpiry'), 'expiry enforced')
  assert.ok(resetSource.includes('resetPasswordToken: null'), 'token single-use (cleared after use)')
})

// =============================================================
// 3. Resend-verification rate limiting + enumeration
// =============================================================

test('resend-verification: route throttles requests server-side', () => {
  const source = read('app/api/auth/resend-verification/route.ts')
  assert.ok(source.includes('resendVerificationRateLimit.limit('), 'route must invoke the limiter')
  assert.ok(source.includes('resend:${ip}'), 'limiter keyed by client IP')
  assert.ok(source.includes('status: 429'), 'throttled response returns 429')
})

test('resend-verification: verified accounts no longer leak verification state', () => {
  const source = read('app/api/auth/resend-verification/route.ts')
  assert.equal(source.includes('Email is already verified'), false, 'must not reveal verified status')
  assert.ok(source.includes('If an account exists with this email, a verification link has been sent'), 'generic response for verified + unknown accounts')
})

test('resend-verification: limiter is defined in the canonical module', () => {
  const source = read('lib/rateLimit.ts')
  assert.ok(source.includes('resendVerificationRateLimit'), 'resendVerificationRateLimit must exist')
})

// =============================================================
// 4. Email-change re-verification
// =============================================================

test('email-change: PATCH /api/user/profile never mutates User.email directly', () => {
  const source = read('app/api/user/profile/route.ts')
  assert.equal(/updateData\.email\s*=\s*body\.email/.test(source), false, 'must not write the requested email into updateData')
  assert.ok(source.includes('sendEmailChangeVerificationEmail('), 'must send a verification challenge to the new address')
  assert.ok(source.includes('emailChangePending'), 'must signal that verification is pending')
  assert.ok(source.includes('User.email is NOT mutated'), 'must keep the old email authoritative until verification')
})

test('email-change: the verification link is sent to the NEW address only', () => {
  const source = read('actions/email.action.ts')
  assert.ok(source.includes('sendEmailChangeVerificationEmail('), 'send function must exist')
  const block = source.slice(source.indexOf('export async function sendEmailChangeVerificationEmail('), source.indexOf('export async function sendPasswordResetEmail('))
  assert.ok(block.includes('crypto.randomBytes(32)'), '256-bit token')
  assert.ok(block.includes("createHash('sha256')"), 'token hashed before persistence')
  assert.ok(block.includes('60 * 60 * 1000'), 'token expires after 1 hour')
  assert.ok(block.includes('to: target'), 'email delivered to the new address')
  assert.equal(block.includes('console.log'), false, 'raw token never logged')
})

test('email-change: verify-email applies the change regardless of current emailVerified state', () => {
  const source = read('app/api/auth/verify-email/route.ts')
  assert.equal(source.includes('user.emailVerified && requestedEmail'), false, 'branch must not be gated on current emailVerified')
  assert.ok(source.includes("requestedEmail !== (user.email || '').toLowerCase()"), 'branch recognized by token + differing target email')
  assert.ok(source.includes('email: requestedEmail'), 'new email applied only on verification')
  assert.ok(source.includes('email: requestedEmail, id: { not: user.id }'), 'new email checked for collisions')
  assert.ok(source.includes('emailVerified: true'), 'verified after confirming the new address')
  assert.ok(source.includes('emailVerificationToken: null'), 'token single-use (cleared after verification)')
})

test('email-change: expired / invalid / used tokens still rejected (expiry precedes both branches)', () => {
  const source = read('app/api/auth/verify-email/route.ts')
  assert.ok(source.includes('emailVerificationTokenExpiresAt <= new Date()'), 'expiry enforced')
  assert.ok(source.includes('Invalid or expired verification token'), 'invalid token rejected')
  assert.ok(source.includes('Verification token has expired'), 'expired token rejected')
})

test('email-change: signup verification path remains unchanged (no differing email)', () => {
  const source = read('app/api/auth/verify-email/route.ts')
  assert.ok(source.includes('emailVerified: true'), 'signup branch flips emailVerified')
  assert.doesNotMatch(source, /sendBrokerVerificationEmail/, 'email verification must NOT send the broker-verified email (Phase 8.36.5)')
  assert.ok(source.includes('getClaimContext'), 'claim redirect flow preserved')
})

test('email-change: the change is scoped to the token-bound user only', () => {
  const source = read('app/api/auth/verify-email/route.ts')
  assert.ok(source.includes('where: { id: user.id }'), 'email update is scoped to the user holding the token')
  assert.ok(source.includes("emailVerificationToken: hashedToken"), 'token matched by its stored hash')
})

test('email-change: verify page sends the target email with the token', () => {
  const source = read('app/(public)/auth/verify-email/page.tsx')
  assert.ok(source.includes('JSON.stringify({ token, email })'), 'verify request must include the target email')
})

test('email-change: client input cannot directly set emailVerified', () => {
  const source = read('app/api/user/profile/route.ts')
  assert.equal(source.includes('updateData.emailVerified'), false, 'PATCH must not accept emailVerified')
})

test('email-change: login/password-reset continue to use the verified email (no change to C1/H3)', () => {
  const authSource = read('lib/auth.config.ts')
  assert.ok(authSource.includes('prisma.user.findUnique'), 'server identity lookup preserved')
  const resetSource = read('app/api/auth/reset-password/route.ts')
  assert.ok(resetSource.includes('email: email.toLowerCase()'), 'password reset keys on email')
})
