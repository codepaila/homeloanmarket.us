import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import nextConfig from '../next.config'

// ===========================================================================
// PHASE 9.3 — HTTP / browser security headers.
//
// Directive-oriented assertions (not one brittle exact CSP string) so the
// policy can evolve without rewriting the suite.
// ===========================================================================

const TEST_DIR = path.dirname(new URL(import.meta.url).pathname)
const read = (relative: string): string => fs.readFileSync(path.resolve(TEST_DIR, '..', relative), 'utf8')

type Header = { key: string; value: string }
type HeaderRule = { source: string; headers: Header[] }

const getRules = () =>
  (nextConfig.headers as unknown as () => Promise<HeaderRule[]>)()

async function globalHeaders(): Promise<Record<string, string>> {
  const rules = await getRules()
  const catchAll = rules.find((rule) => rule.source === '/(.*)')
  assert.ok(catchAll, 'a global (/(.*)) header rule must exist')
  return Object.fromEntries(catchAll.headers.map((h) => [h.key.toLowerCase(), h.value]))
}

function directives(csp: string): Record<string, string> {
  return Object.fromEntries(
    csp.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
      const [name, ...rest] = part.split(/\s+/)
      return [name, rest.join(' ')]
    }),
  )
}

// ---------------------------------------------------------------------------
// Base headers
// ---------------------------------------------------------------------------

test('X-Content-Type-Options is nosniff', async () => {
  assert.equal((await globalHeaders())['x-content-type-options'], 'nosniff')
})

test('Referrer-Policy is strict-origin-when-cross-origin', async () => {
  assert.equal((await globalHeaders())['referrer-policy'], 'strict-origin-when-cross-origin')
})

test('Permissions-Policy denies unused features and keeps clipboard-write for self', async () => {
  const value = (await globalHeaders())['permissions-policy']
  assert.ok(value, 'Permissions-Policy must be present')
  for (const deny of ['camera=()', 'microphone=()', 'geolocation=()', 'payment=()', 'usb=()']) {
    assert.ok(value.includes(deny), `must deny ${deny}`)
  }
  assert.ok(value.includes('clipboard-write=(self)'), 'clipboard-write must be allowed for self (admin copy actions)')
  assert.ok(!/clipboard-write=\(\)/.test(value), 'clipboard-write must not be globally denied')
})

test('clickjacking protection is present via frame-ancestors and X-Frame-Options', async () => {
  const headers = await globalHeaders()
  assert.ok(directives(headers['content-security-policy'])['frame-ancestors'].includes("'self'"))
  assert.equal(headers['x-frame-options'], 'SAMEORIGIN')
})

// ---------------------------------------------------------------------------
// CSP directives
// ---------------------------------------------------------------------------

test('CSP contains the required hardening directives', async () => {
  const csp = (await globalHeaders())['content-security-policy']
  assert.ok(csp, 'CSP must be present')
  const d = directives(csp)
  assert.equal(d['default-src'], "'self'")
  assert.equal(d['base-uri'], "'self'")
  assert.equal(d['object-src'], "'none'")
  assert.equal(d['form-action'], "'self'")
  assert.ok(d['frame-ancestors'].includes("'self'"))
  assert.equal(d['frame-src'], "'none'")
})

test('CSP does not permit unsafe-eval', async () => {
  const csp = (await globalHeaders())['content-security-policy']
  assert.ok(!csp.includes("'unsafe-eval'"), 'unsafe-eval must not be present')
})

test("CSP permits 'unsafe-inline' only for script/style (audited Next.js requirement)", async () => {
  const d = directives((await globalHeaders())['content-security-policy'])
  assert.ok(d['script-src'].includes("'unsafe-inline'"))
  assert.ok(d['style-src'].includes("'unsafe-inline'"))
  // unsafe-inline must not leak into other fetch directives.
  for (const name of ['img-src', 'connect-src', 'font-src']) {
    assert.ok(!d[name].includes("'unsafe-inline'"), `${name} must not allow unsafe-inline`)
  }
})

test('CSP allowlists the analytics origins required by GTM/GA4', async () => {
  const d = directives((await globalHeaders())['content-security-policy'])
  assert.ok(d['script-src'].includes('https://www.googletagmanager.com'))
  assert.ok(d['connect-src'].includes('https://www.googletagmanager.com'))
  assert.ok(d['connect-src'].includes('https://www.google-analytics.com'))
  assert.ok(d['connect-src'].includes('https://*.google-analytics.com'))
})

test('CSP image sources support stored/admin-managed images (Cloudinary/Unsplash/YouTube)', async () => {
  const d = directives((await globalHeaders())['content-security-policy'])
  assert.ok(d['img-src'].includes("'self'"))
  assert.ok(d['img-src'].includes('data:'))
  assert.ok(d['img-src'].includes('blob:'))
  assert.ok(d['img-src'].includes('https:'), 'https image URLs (Cloudinary, Unsplash, blog/broker content) must be allowed')
})

// ---------------------------------------------------------------------------
// HSTS (conditional on production)
// ---------------------------------------------------------------------------

// process.env.NODE_ENV is typed read-only by Next's `next-env.d.ts`; the
// runtime value can still be swapped for the duration of a test.
function setNodeEnv(value: string) {
  ;(process.env as Record<string, string | undefined>).NODE_ENV = value
}

test('HSTS is emitted only in production with a safe policy', async () => {
  const original = process.env.NODE_ENV
  try {
    setNodeEnv('production')
    const prod = (await globalHeaders())['strict-transport-security']
    assert.ok(prod, 'HSTS must be present in production')
    assert.match(prod, /max-age=31536000/)
    assert.ok(!/includeSubDomains/i.test(prod), 'includeSubDomains must not be enabled without verification')
    assert.ok(!/preload/i.test(prod), 'preload must not be enabled without verification')

    setNodeEnv('test')
    const nonProd = (await globalHeaders())['strict-transport-security']
    assert.equal(nonProd, undefined, 'HSTS must be omitted outside production (localhost must not be pinned)')
  } finally {
    if (original === undefined) delete (process.env as Record<string, string | undefined>).NODE_ENV
    else setNodeEnv(original)
  }
})

// ---------------------------------------------------------------------------
// X-Powered-By
// ---------------------------------------------------------------------------

test('poweredByHeader is disabled', () => {
  assert.equal(nextConfig.poweredByHeader, false)
})

test('no application code sets X-Powered-By', () => {
  for (const file of ['proxy.ts', 'next.config.ts']) {
    const code = read(file).replace(/\/\/.*$/gm, '')
    assert.doesNotMatch(code, /x-powered-by/i, `${file} must not set X-Powered-By`)
  }
})

// ---------------------------------------------------------------------------
// Preserved existing configuration (regression)
// ---------------------------------------------------------------------------

test('existing next.config.ts settings are preserved', () => {
  assert.equal(nextConfig.compress, true)
  assert.equal(nextConfig.productionBrowserSourceMaps, false)
  assert.deepEqual(
    nextConfig.images?.remotePatterns?.map((p) => (p as { hostname: string }).hostname).sort(),
    ['images.unsplash.com', 'img.youtube.com', 'res.cloudinary.com'].sort(),
  )
  assert.ok(nextConfig.experimental?.optimizePackageImports)
  assert.ok(nextConfig.turbopack)
})

test('cache policy separates public and private/authenticated surfaces', async () => {
  const rules = await getRules()
  const cache = (source: string) => {
    const rule = rules.find((r) => r.source === source)
    return rule?.headers.find((h) => h.key === 'Cache-Control')?.value
  }
  // Private/authenticated surfaces.
  assert.equal(cache('/api/:path*'), 'private, no-store, no-cache, must-revalidate')
  assert.equal(cache('/admin/:path*'), 'private, no-store, no-cache, must-revalidate')
  assert.equal(cache('/broker/:path*'), 'private, no-store, no-cache, must-revalidate')
  assert.equal(cache('/dashboard/:path*'), 'private, no-store, no-cache, must-revalidate')
  // Public, non-session-varying API surfaces.
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
    assert.equal(cache(source), 'public, max-age=0, must-revalidate', `${source} must stay public`)
  }
  // Global default for public pages.
  assert.equal(cache('/(.*)'), 'public, max-age=0, must-revalidate')
})

test('global public rule precedes the private API rule (last-match-wins)', async () => {
  const rules = await getRules()
  const globalIdx = rules.findIndex((r) => r.source === '/(.*)')
  const apiIdx = rules.findIndex((r) => r.source === '/api/:path*')
  assert.ok(globalIdx >= 0 && apiIdx >= 0)
  assert.ok(globalIdx < apiIdx, 'the private /api rule must come after the catch-all so it wins')
})

// ---------------------------------------------------------------------------
// No unrelated cross-origin isolation policies / no new middleware
// ---------------------------------------------------------------------------

test('COOP/CORP are not enabled (cross-origin OAuth/redirect/asset flows preserved)', async () => {
  const headers = await globalHeaders()
  assert.equal(headers['cross-origin-opener-policy'], undefined)
  assert.equal(headers['cross-origin-resource-policy'], undefined)
})

test('no middleware.ts was created and proxy.ts remains', () => {
  assert.ok(fs.existsSync(path.resolve(TEST_DIR, '..', 'proxy.ts')), 'proxy.ts must remain')
  assert.equal(fs.existsSync(path.resolve(TEST_DIR, '..', 'middleware.ts')), false, 'no middleware.ts may be added')
})

// ---------------------------------------------------------------------------
// Third-party / consent compatibility (static regression)
// ---------------------------------------------------------------------------

test('analytics scripts remain consent-gated', () => {
  const provider = read('lib/analytics/provider.tsx')
  assert.match(provider, /if \(consent !== "accepted"\) return null/)
  assert.match(provider, /GoogleTagManager/)
  assert.match(provider, /GoogleAnalytics/)
})

test('no client-side Stripe.js / iframe embeds require additional CSP origins', () => {
  const files = [
    'app/layout.tsx',
    'components/forms/ContactForm.tsx',
    'components/forms/BrokerContactForm.tsx',
  ]
  for (const file of files) {
    assert.doesNotMatch(read(file), /@stripe\/stripe-js|loadStripe/)
  }
  assert.equal(fs.existsSync(path.resolve(TEST_DIR, '..', 'app/api/stripe/webhook/route.ts')), true, 'Stripe webhook route intact')
})

test('remote image hosts remain available to next/image', () => {
  const patterns = (nextConfig.images?.remotePatterns ?? []) as Array<{ hostname: string }>
  const hosts = patterns.map((p) => p.hostname)
  for (const host of ['res.cloudinary.com', 'images.unsplash.com', 'img.youtube.com']) {
    assert.ok(hosts.includes(host), `${host} must remain in images.remotePatterns`)
  }
})
