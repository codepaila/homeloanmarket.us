import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const TEST_DIR = path.dirname(new URL(import.meta.url).pathname)
const read = (relative: string): string => fs.readFileSync(path.resolve(TEST_DIR, '..', relative), 'utf8')

// =============================================================
// Single authentication secret — AUTH_SECRET is authoritative
// =============================================================

test('auth.config.ts: secret comes from AUTH_SECRET, never NEXTAUTH_SECRET', () => {
  const source = read('lib/auth.config.ts')
  assert.ok(source.includes('secret: process.env.AUTH_SECRET'), 'Auth.js must sign with AUTH_SECRET')
  assert.equal(/secret:\s*process\.env\.NEXTAUTH_SECRET/.test(source), false, 'must not sign with NEXTAUTH_SECRET')
})

test('proxy.ts: decodes with AUTH_SECRET only (no NEXTAUTH fallback)', () => {
  const source = read('proxy.ts')
  assert.ok(source.includes('const AUTH_SECRET = process.env.AUTH_SECRET'), 'proxy must use AUTH_SECRET')
  assert.equal(source.includes('process.env.NEXTAUTH_SECRET'), false, 'proxy must not fall back to NEXTAUTH_SECRET')
})

test('claim-context.ts: HMAC secret derives from AUTH_SECRET', () => {
  const source = read('lib/claim-context.ts')
  assert.ok(source.includes('process.env.AUTH_SECRET'), 'claim context must use AUTH_SECRET')
  assert.equal(source.includes('process.env.NEXTAUTH_SECRET'), false, 'claim context must not use NEXTAUTH_SECRET')
})

test('production auth code contains zero live NEXTAUTH_SECRET reads', () => {
  const files = ['proxy.ts', 'lib/auth.config.ts', 'lib/auth.ts', 'lib/claim-context.ts', 'lib/currentUser.ts', 'lib/auth-redirect.ts']
  for (const file of files) {
    const source = read(file)
    // A comment may mention the name; a live read must not.
    assert.equal(/process\.env\.NEXTAUTH_SECRET/.test(source), false, `${file} must not read NEXTAUTH_SECRET`)
  }
})

// =============================================================
// Proxy/Auth.js cookie agreement — the production root cause
// =============================================================

test('proxy.ts: passes secureCookie to getToken so the HTTPS cookie prefix matches Auth.js', () => {
  const source = read('proxy.ts')
  assert.ok(source.includes('secureCookie:'), 'getToken must pass secureCookie')
  assert.ok(source.includes('getToken({'), 'getToken is the session validator in proxy')
})

test('proxy.ts: secureCookie derivation matches Auth.js HTTPS rule (AUTH_URL https -> __Secure- prefix)', () => {
  const source = read('proxy.ts')
  assert.ok(source.includes('secureSessionCookies'), 'secure-cookie helper must exist')
  const block = source.slice(source.indexOf('function secureSessionCookies'), source.indexOf('export default async function proxy'))
  assert.ok(block.includes('/^https:\\/\\//i.test(authUrl)'), 'https AUTH_URL -> secure cookies')
  assert.ok(block.includes('/^http:\\/\\//i.test(authUrl)'), 'http AUTH_URL -> non-secure cookies')
})

test('proxy.ts: role authorization gates are preserved (admin/broker/dashboard)', () => {
  const source = read('proxy.ts')
  assert.ok(source.includes("path.startsWith('/admin')") && source.includes("userRole !== 'ADMIN'"), 'admin gate preserved')
  assert.ok(source.includes("path.startsWith('/broker')") && source.includes("userRole !== 'BROKER'"), 'broker gate preserved')
  assert.ok(source.includes('roleHome(userRole)'), 'role-scoped redirect preserved')
})

// =============================================================
// Email normalization at the credential boundary
// =============================================================

test('auth.config.ts: authorize normalizes email (trim + lowercase) before lookup', () => {
  const source = read('lib/auth.config.ts')
  const block = source.slice(source.indexOf('async authorize'), source.indexOf('prisma.user.findUnique'))
  assert.ok(block.includes('String(credentials.email).trim().toLowerCase()'), 'email normalized before DB lookup')
})

test('login action: credential lookup is normalized and role-aware redirect preserved', () => {
  const source = read('actions/auth.action.ts')
  assert.ok(source.includes('.trim().toLowerCase()'), 'login action normalizes email')
  assert.ok(source.includes('postLoginRedirect('), 'role-aware redirect preserved')
  assert.ok(source.includes('loginRateLimit.limit('), 'login rate limiting preserved')
  assert.ok(source.includes('login:${ip}'), 'limiter keyed by client IP')
})

// =============================================================
// Callback URL security preserved
// =============================================================

test('auth-redirect: open redirect protection is preserved', () => {
  const source = read('lib/auth-redirect.ts')
  assert.ok(source.includes('sanitizeCallbackUrl'), 'callback sanitizer preserved')
  assert.ok(source.includes('parsed.origin !== base.origin'), 'cross-origin callbacks rejected')
  assert.ok(source.includes('isAuthorizedDestination'), 'role-scoped destination check preserved')
  assert.ok(source.includes("role === 'ADMIN'"), 'admin destination binding preserved')
})

// =============================================================
// Cache policy: sensitive routes are not publicly cacheable
// =============================================================

test('next.config.ts: session/auth/admin/broker routes are no-store', () => {
  const source = read('next.config.ts')
  assert.ok(source.includes('/api/auth/:path*'), 'auth API excluded from public cache')
  assert.ok(source.includes('/admin/:path*'), 'admin routes excluded from public cache')
  assert.ok(source.includes('/broker/:path*'), 'broker routes excluded from public cache')
  assert.ok(source.includes('private, no-store, no-cache, must-revalidate'), 'sensitive routes use no-store')
})

// =============================================================
// Canonical URL: AUTH_URL is the production base URL source
// =============================================================

test('production URL sources are canonical (AUTH_URL / NEXT_PUBLIC_APP_URL)', () => {
  const authAction = read('actions/auth.action.ts')
  assert.ok(authAction.includes('process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL'), 'auth action uses canonical URL sources')
  const subscription = read('actions/subscription.ts')
  assert.equal(/process\.env\.NEXTAUTH_URL/.test(subscription), false, 'subscription actions must not use NEXTAUTH_URL')
  const seo = read('lib/seo.ts')
  assert.ok(seo.includes('process.env.AUTH_URL'), 'seo site URL may derive from AUTH_URL')
})
