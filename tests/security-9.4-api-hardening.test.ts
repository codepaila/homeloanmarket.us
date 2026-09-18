import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import nextConfig from '../next.config'
import { parseBoundedPositiveInt } from '../utils'

const TEST_DIR = path.dirname(new URL(import.meta.url).pathname)
const read = (relative: string): string => fs.readFileSync(path.resolve(TEST_DIR, '..', relative), 'utf8')

type HeaderRule = { source: string; headers: Array<{ key: string; value: string }> }
const getRules = () => (nextConfig.headers as unknown as () => Promise<HeaderRule[]>)()

// ===========================================================================
// Cache isolation
// ===========================================================================

test('all API responses default to private/no-store (never publicly cacheable)', async () => {
  const rules = await getRules()
  const rule = rules.find((r) => r.source === '/api/:path*')
  assert.ok(rule, 'a catch-all /api/:path* rule must exist')
  assert.equal(
    rule.headers.find((h) => h.key === 'Cache-Control')?.value,
    'private, no-store, no-cache, must-revalidate',
  )
})

test('authenticated page areas are private/no-store and ordered to win', async () => {
  const rules = await getRules()
  const globalIdx = rules.findIndex((r) => r.source === '/(.*)')
  for (const source of ['/admin/:path*', '/broker/:path*', '/dashboard/:path*']) {
    const idx = rules.findIndex((r) => r.source === source)
    assert.ok(idx > globalIdx, `${source} must be ordered after the catch-all so it wins`)
    assert.equal(
      rules[idx].headers.find((h) => h.key === 'Cache-Control')?.value,
      'private, no-store, no-cache, must-revalidate',
    )
  }
})

test('public non-session API surfaces remain public', async () => {
  const rules = await getRules()
  for (const source of [
    '/api/brokers/featured',
    '/api/subscription/plans',
    '/api/company/subscription/plans',
    '/api/company/:slug/reviews',
    '/api/ads/public',
    '/api/cities',
    '/api/states',
    '/api/property-types',
  ]) {
    const rule = rules.find((r) => r.source === source)
    assert.ok(rule, `${source} must exist`)
    assert.equal(
      rule.headers.find((h) => h.key === 'Cache-Control')?.value,
      'public, max-age=0, must-revalidate',
      `${source} must stay public`,
    )
  }
})

test('session-varying public broker reads are NOT left publicly cacheable', async () => {
  const rules = await getRules()
  const apiRule = rules.find((r) => r.source === '/api/:path*')
  // /api/brokers and /api/brokers/[id] vary by admin/owner; they must not be
  // re-allowed as public.
  const reAllowed = rules.map((r) => r.source)
  assert.ok(!reAllowed.includes('/api/brokers'))
  assert.ok(!reAllowed.includes('/api/brokers/:id'))
  assert.ok(apiRule)
})

// ===========================================================================
// Pagination bound helper
// ===========================================================================

test('parseBoundedPositiveInt rejects NaN/Infinity/negative/zero/non-integer', () => {
  assert.equal(parseBoundedPositiveInt('3', 1), 3)
  assert.equal(parseBoundedPositiveInt('  7 ', 1), 7)
  assert.equal(parseBoundedPositiveInt(undefined, 20), 20)
  assert.equal(parseBoundedPositiveInt(null, 20), 20)
  assert.equal(parseBoundedPositiveInt('', 20), 20)
  assert.equal(parseBoundedPositiveInt('abc', 20), 20)
  assert.equal(parseBoundedPositiveInt('Infinity', 20), 20)
  assert.equal(parseBoundedPositiveInt('-Infinity', 20), 20)
  assert.equal(parseBoundedPositiveInt('NaN', 20), 20)
  assert.equal(parseBoundedPositiveInt('-5', 20), 20)
  assert.equal(parseBoundedPositiveInt('0', 20), 20)
  assert.equal(parseBoundedPositiveInt('3.5', 20), 20)
  assert.equal(Math.min(parseBoundedPositiveInt('99999', 20), 100), 100)
})

test('authenticated list endpoints use bounded pagination', () => {
  for (const file of [
    'app/api/brokers/[id]/contacts/route.ts',
    'app/api/contacts/my/route.ts',
    'app/api/admin/contact/route.ts',
    'app/api/admin/media/route.ts',
  ]) {
    const source = read(file)
    assert.match(source, /parseBoundedPositiveInt/, `${file} must use the bounded pagination helper`)
    assert.doesNotMatch(source, /parseInt\(searchParams\.get\(['"]limit['"]\)/, `${file} must not parse limit unbounded`)
  }
})

test('admin bulk ad ids array is bounded', () => {
  assert.match(read('lib/advertisements/validation.ts'), /\.max\(200, "At most 200 ads per request"\)/)
})

// ===========================================================================
// Rate limiting
// ===========================================================================

test('reset-password has a distributed limiter and applies it', () => {
  assert.match(read('lib/rateLimit.ts'), /export const resetPasswordRateLimit = new Ratelimit/)
  const route = read('app/api/auth/reset-password/route.ts')
  assert.match(route, /resetPasswordRateLimit\.limit/)
  assert.match(route, /status: 429/)
})

test('upload endpoint has a distributed limiter and applies it', () => {
  assert.match(read('lib/rateLimit.ts'), /export const uploadImageRateLimit = new Ratelimit/)
  const route = read('app/api/upload/image/route.ts')
  assert.match(route, /uploadImageRateLimit\.limit/)
  assert.match(route, /status: 429/)
})

// ===========================================================================
// Same-origin protection on cookie-auth mutations
// ===========================================================================

test('sensitive cookie-auth mutations enforce isSameOriginRequest', () => {
  const files = [
    'app/api/subscription/checkout/route.ts',
    'app/api/subscription/cancel/route.ts',
    'app/api/subscription/portal/route.ts',
    'app/api/subscription/upgrade/route.ts',
    'app/api/user/profile/route.ts',
    'app/api/brokers/[id]/route.ts',
    'app/api/company/[slug]/route.ts',
    'app/api/company/[slug]/reviews/route.ts',
    'app/api/brokers/me/profile-image/route.ts',
    'app/api/brokers/me/cover-image/route.ts',
    'app/api/contacts/[id]/read/route.ts',
    'app/api/contacts/[id]/responded/route.ts',
    'app/api/company/subscription/portal/route.ts',
  ]
  for (const file of files) {
    const source = read(file)
    assert.match(source, /isSameOriginRequest/, `${file} must import/use isSameOriginRequest`)
    assert.match(source, /status: 403/, `${file} must reject invalid origins with 403`)
  }
})

test('no second origin helper was introduced', () => {
  assert.equal(fs.existsSync(path.resolve(TEST_DIR, '..', 'lib/same-origin.ts')), false)
  const origin = read('lib/origin.ts')
  assert.match(origin, /export function isSameOriginRequest/)
})

// ===========================================================================
// Error safety on public endpoints
// ===========================================================================

test('public broker/company endpoints do not return raw error messages', () => {
  for (const file of [
    'app/api/brokers/route.ts',
    'app/api/brokers/[id]/route.ts',
    'app/api/brokers/featured/route.ts',
    'app/api/company/[slug]/route.ts',
    'app/api/company/[slug]/reviews/route.ts',
  ]) {
    const source = read(file)
    assert.doesNotMatch(source, /error:\s*error\.message/, `${file} must not return error.message`)
    assert.doesNotMatch(
      source,
      /error:\s*error instanceof Error \? error\.message/,
      `${file} must not return error.message`,
    )
    assert.doesNotMatch(source, /error:\s*error\b/, `${file} must not return a raw error object`)
  }
})

// ===========================================================================
// Business-rule preservation
// ===========================================================================

test('public broker email/phone remain public (no contact gating introduced)', () => {
  assert.match(read('app/api/brokers/route.ts'), /includeContact: true/)
  assert.match(read('app/api/brokers/[id]/route.ts'), /includeContact: true/)
  assert.match(read('app/api/company/[slug]/route.ts'), /includeContact: true/)
  assert.match(read('app/api/brokers/featured/route.ts'), /email: true/)
})

test('protected architecture is unchanged', () => {
  assert.ok(fs.existsSync(path.resolve(TEST_DIR, '..', 'proxy.ts')))
  assert.equal(fs.existsSync(path.resolve(TEST_DIR, '..', 'middleware.ts')), false)
  assert.equal(nextConfig.poweredByHeader, false)
})
