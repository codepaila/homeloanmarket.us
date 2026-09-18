import { NextRequest } from 'next/server'
import { mock, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

// ===========================================================================
// SEC-03 — Anonymous ad click/impression inflation hardening.
// ===========================================================================

const TEST_DIR = path.dirname(new URL(import.meta.url).pathname)
const read = (relative: string): string => fs.readFileSync(path.resolve(TEST_DIR, '..', relative), 'utf8')

const impressionSource = read('app/api/ads/impression/route.ts')
const clickSource = read('app/api/ads/click/route.ts')
const rateLimitSource = read('lib/rateLimit.ts')

test('ad event routes rate-limit before any database work', () => {
  const impressionLimitIdx = impressionSource.indexOf('adImpressionRateLimitExceeded(ip)')
  const impressionLookupIdx = impressionSource.indexOf('getPublishableById')
  assert.ok(impressionLimitIdx > 0 && impressionLimitIdx < impressionLookupIdx, 'impression rate limit precedes ad lookup')

  const clickLimitIdx = clickSource.indexOf('adClickRateLimitExceeded(ip)')
  const clickLookupIdx = clickSource.indexOf('getPublishableById')
  assert.ok(clickLimitIdx > 0 && clickLimitIdx < clickLookupIdx, 'click rate limit precedes ad lookup')
})

test('ad event limiters + impression dedup live in the canonical rate-limit module', () => {
  assert.match(rateLimitSource, /export const adImpressionRateLimit = new Ratelimit/)
  assert.match(rateLimitSource, /export const adClickRateLimit = new Ratelimit/)
  assert.match(rateLimitSource, /export const adImpressionDedup = new Ratelimit/)
  assert.match(rateLimitSource, /export async function adImpressionRateLimitExceeded/)
  assert.match(rateLimitSource, /export async function adClickRateLimitExceeded/)
  assert.match(rateLimitSource, /export async function adImpressionIsDuplicate/)
})

test('ad event routes bound stored metadata', () => {
  assert.match(impressionSource, /boundedString/)
  assert.match(clickSource, /boundedString/)
  assert.match(impressionSource, /AD_ID_MAX/)
  assert.match(clickSource, /AD_ID_MAX/)
})

// ---------------------------------------------------------------------------
// Runtime harness
// ---------------------------------------------------------------------------

const state = {
  publishable: { buttonUrl: 'https://example.com/offer', bannerUrl: null } as null | { buttonUrl: string | null; bannerUrl: string | null },
  impressions: [] as Array<Record<string, unknown>>,
  clicks: [] as Array<Record<string, unknown>>,
  rate: { impressionExceeded: false, clickExceeded: false, impressionDuplicate: false, impressionDedupUnavailable: false },
  dbDuplicate: null as null | { createdAt: Date },
}

function reset() {
  state.publishable = { buttonUrl: 'https://example.com/offer', bannerUrl: null }
  state.impressions = []
  state.clicks = []
  state.rate = { impressionExceeded: false, clickExceeded: false, impressionDuplicate: false, impressionDedupUnavailable: false }
  state.dbDuplicate = null
}

mock.module('@/lib/advertisements/services', {
  namedExports: {
    AdvertisementService: {
      getPublishableById: async () => state.publishable,
      recordImpression: async (params: Record<string, unknown>) => {
        state.impressions.push(params)
        return params
      },
      recordClick: async (params: Record<string, unknown>) => {
        state.clicks.push(params)
        return params
      },
    },
  },
})

mock.module('@/lib/rateLimit', {
  namedExports: {
    adImpressionRateLimitExceeded: async () => state.rate.impressionExceeded,
    adClickRateLimitExceeded: async () => state.rate.clickExceeded,
    adImpressionIsDuplicate: async () => state.rate.impressionDuplicate,
  },
})

mock.module('@/lib/prisma', {
  defaultExport: {
    adEvent: {
      findFirst: async () => state.dbDuplicate,
    },
  },
})

const impressionRoute = () => import('../app/api/ads/impression/route')
const clickRoute = () => import('../app/api/ads/click/route')

function post(handler: (req: NextRequest) => Promise<Response>, url: string, body: unknown) {
  return handler(
    new NextRequest(`https://homeloanmarket.com${url}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7' },
      body: JSON.stringify(body),
    }),
  )
}

const AD_ID = '507f1f77bcf86cd799439011'

test('valid published impression is recorded once', async () => {
  reset()
  const { POST } = await impressionRoute()
  const res = await post(POST, '/api/ads/impression', { advertisementId: AD_ID, page: '/' })
  assert.equal(res.status, 200)
  assert.equal((await res.json()).success, true)
  assert.equal(state.impressions.length, 1)
})

test('valid published click is recorded and returns a safe redirect', async () => {
  reset()
  const { POST } = await clickRoute()
  const res = await post(POST, '/api/ads/click', { advertisementId: AD_ID, page: '/' })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.success, true)
  assert.equal(body.redirectUrl, 'https://example.com/offer')
  assert.equal(state.clicks.length, 1)
})

test('invalid ad id is rejected and records no event', async () => {
  reset()
  state.publishable = null
  const { POST } = await impressionRoute()
  const res = await post(POST, '/api/ads/impression', { advertisementId: AD_ID })
  assert.equal(res.status, 404)
  assert.equal(state.impressions.length, 0)
})

test('oversized advertisement id is rejected before any lookup', async () => {
  reset()
  const { POST } = await impressionRoute()
  const res = await post(POST, '/api/ads/impression', { advertisementId: 'x'.repeat(65) })
  assert.equal(res.status, 400)
  assert.equal(state.impressions.length, 0)
})

test('impression rate limit returns 429 and records no event', async () => {
  reset()
  state.rate.impressionExceeded = true
  const { POST } = await impressionRoute()
  const res = await post(POST, '/api/ads/impression', { advertisementId: AD_ID })
  assert.equal(res.status, 429)
  assert.equal(state.impressions.length, 0)
})

test('click rate limit returns 429 and records no event', async () => {
  reset()
  state.rate.clickExceeded = true
  const { POST } = await clickRoute()
  const res = await post(POST, '/api/ads/click', { advertisementId: AD_ID })
  assert.equal(res.status, 429)
  assert.equal(state.clicks.length, 0)
})

test('duplicate impression inside the dedup window records no second event', async () => {
  reset()
  state.rate.impressionDuplicate = true
  const { POST } = await impressionRoute()
  const res = await post(POST, '/api/ads/impression', { advertisementId: AD_ID })
  assert.equal(res.status, 200)
  assert.equal((await res.json()).deduplicated, true)
  assert.equal(state.impressions.length, 0)
})

test('database dedup fallback still suppresses a duplicate impression', async () => {
  reset()
  state.dbDuplicate = { createdAt: new Date() }
  const { POST } = await impressionRoute()
  const res = await post(POST, '/api/ads/impression', { advertisementId: AD_ID })
  assert.equal(res.status, 200)
  assert.equal((await res.json()).deduplicated, true)
  assert.equal(state.impressions.length, 0)
})

test('oversized tracking metadata is bounded before storage', async () => {
  reset()
  const { POST } = await impressionRoute()
  const res = await post(POST, '/api/ads/impression', {
    advertisementId: AD_ID,
    page: 'p'.repeat(2000),
    referrer: 'r'.repeat(2000),
  })
  assert.equal(res.status, 200)
  assert.equal(state.impressions.length, 1)
  assert.ok((state.impressions[0].page as string).length <= 512)
  assert.ok((state.impressions[0].referrer as string).length <= 512)
})
