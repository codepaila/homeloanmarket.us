import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const proxy = fs.readFileSync('proxy.ts', 'utf8')

// ============================================================================
// PUBLIC ENDPOINT TESTS
// ============================================================================

test('GET /api/subscription/plans is in PUBLIC_METHOD_AWARE_API', () => {
  assert.match(proxy, /\/api\/subscription\/plans/)
  assert.match(proxy, /PUBLIC_METHOD_AWARE_API/)
})

test('GET /api/subscription/plans is GET-only (not POST)', () => {
  // Structure-independent: assert the plans rule is method-aware GET and never
  // ALL/POST, regardless of whether the object lists method before or after
  // the pattern. The rule must never open POST to the public plans surface.
  const rules = proxy.split('\n').filter((line) => line.includes('subscription') && line.includes('plans'))
  assert.ok(rules.length > 0, 'Plans rule must exist')
  assert.ok(rules.some((line) => /method:\s*['"]GET['"]/.test(line)), 'Plans rule must be method: GET')
  assert.ok(rules.every((line) => !/method:\s*(['"]ALL['"]|['"]POST['"])/.test(line)), 'Plans rule must not be ALL/POST')
})

test('isPublicMethodAwareApi function is defined', () => {
  assert.match(proxy, /function isPublicMethodAwareApi/)
})

test('isPublicMethodAwareApi is called in public path chain', () => {
  assert.match(proxy, /isPublicMethodAwareApi\(method,\s*path\)/)
})

// ============================================================================
// PROTECTED ENDPOINT TESTS
// ============================================================================

test('POST /api/subscription/checkout is NOT in PUBLIC_METHOD_AWARE_API', () => {
  const checkoutMatch = proxy.match(/pattern:\s*\/.*subscription.*checkout.*\/\s*,\s*method:\s*['"](GET|ALL)['"]/)
  assert.ok(!checkoutMatch, 'Checkout must NOT be in public method-aware list')
})

test('/api/subscription/details is NOT public', () => {
  const detailsPublic = proxy.match(/pattern:\s*\/.*subscription.*details.*\/\s*,\s*method:\s*['"](GET|ALL)['"]/)
  assert.ok(!detailsPublic)
})

test('/api/subscription/usage is NOT public', () => {
  const usagePublic = proxy.match(/pattern:\s*\/.*subscription.*usage.*\/\s*,\s*method:\s*['"](GET|ALL)['"]/)
  assert.ok(!usagePublic)
})

test('/api/subscription/portal is NOT public', () => {
  const portalPublic = proxy.match(/pattern:\s*\/.*subscription.*portal.*\/\s*,\s*method:\s*['"](GET|ALL)['"]/)
  assert.ok(!portalPublic)
})

test('/api/subscription/cancel is NOT public', () => {
  const cancelPublic = proxy.match(/pattern:\s*\/.*subscription.*cancel.*\/\s*,\s*method:\s*['"](GET|POST|ALL)['"]/)
  assert.ok(!cancelPublic)
})

test('/api/subscription/upgrade is NOT public', () => {
  const upgradePublic = proxy.match(/pattern:\s*\/.*subscription.*upgrade.*\/\s*,\s*method:\s*['"](GET|POST|ALL)['"]/)
  assert.ok(!upgradePublic)
})

// ============================================================================
// PRESERVED SECURITY TESTS
// ============================================================================

test('/api/brokers/me is still excluded from public', () => {
  assert.match(proxy, /!\s*path\.includes\(['"]\/me['"]\)/)
  assert.match(proxy, /startsWith\(['"]\/api\/brokers\/['"]\)/)
})

test('/api/company/ remains public (existing broad rule)', () => {
  assert.match(proxy, /startsWith\(['"]\/api\/company\/['"]\)/)
})

test('/api/stripe/webhook remains public (Stripe sig is auth)', () => {
  assert.match(proxy, /startsWith\(['"]\/api\/stripe\/webhook['"]\)/)
})

test('/api/auth/* remains public (Auth.js handler)', () => {
  assert.match(proxy, /startsWith\(['"]\/api\/auth['"]\)/)
})

// ============================================================================
// PAGE PATHS TESTS
// ============================================================================

test('/subscription page is public', () => {
  assert.match(proxy, /['"]\/subscription['"]/)
})

test('No duplicate path.startsWith(/subscription) rules', () => {
  // Count occurrences of the subscription startsWith check - should be minimal
  const matches = proxy.match(/path\.startsWith\(['"]\/subscription['"]\)/g) || []
  assert.ok(matches.length <= 2, `Expected ≤2 subscription startsWith, got ${matches.length}`)
})

// ============================================================================
// DOCUMENTATION TESTS
// ============================================================================

test('Proxy has documented public path map comment', () => {
  assert.match(proxy, /PUBLIC PATH.*ENDPOINT RULES/s)
})

test('Company API security note is documented', () => {
  assert.match(proxy, /Security risk.*api\/company/si)
})

test('BROKERS me exclusion note is present', () => {
  assert.match(proxy, /api\/brokers\/me.*PROTECTED/si)
})
