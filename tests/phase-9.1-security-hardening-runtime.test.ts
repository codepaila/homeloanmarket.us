/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from 'node:assert/strict'
import { mock, test } from 'node:test'
import { NextRequest } from 'next/server'

// ===========================================================================
// PHASE 9.1 runtime — provider-call prevention + profile-view dedup
// ===========================================================================

const state = {
  company: null as any,
  couponCalls: 0,
  couponAllowed: true,
  geocodeCalls: 0,
  locationExceeded: false,
  viewAllowed: true,
  viewThrows: false,
  increments: 0,
}

mock.module('@/lib/origin', {
  exports: { isSameOriginRequest: () => true, clientIp: () => '203.0.113.9' },
} as never)

mock.module('@/lib/company-policy', {
  exports: { getCurrentCompany: async () => state.company },
} as never)

mock.module('@/lib/company-coupon', {
  exports: {
    validateCompanyCoupon: async () => {
      state.couponCalls += 1
      return { valid: false, reason: 'This promotion code is not valid' }
    },
  },
} as never)

mock.module('@/lib/rateLimit', {
  exports: {
    companyCouponValidateRateLimit: { limit: async () => ({ success: state.couponAllowed }) },
    locationLookupExceeded: async () => state.locationExceeded,
    profileViewDedup: { limit: async () => ({ success: state.viewAllowed }) },
  },
} as never)

mock.module('@/lib/location/google-place', {
  exports: {
    autocompleteUSPlaces: async () => [],
    geocodeUSAddress: async () => {
      state.geocodeCalls += 1
      return { normalizedAddress: 'x', city: 'x', state: 'TX', zip: '1', countryCode: 'US', latitude: 1, longitude: 2 }
    },
    resolveUSPlace: async () => ({ normalizedAddress: 'x', city: 'x', state: 'TX', zip: '1', countryCode: 'US', latitude: 1, longitude: 2 }),
  },
} as never)

mock.module('@/lib/location/search-token', {
  exports: { issueSearchLocationToken: () => 'signed-token' },
} as never)

mock.module('@/lib/prisma', {
  exports: {
    default: {
      broker: {
        update: async () => {
          if (state.viewThrows) throw new Error('db unavailable')
          state.increments += 1
          return {}
        },
      },
    },
  },
} as never)

function post(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://app.test' },
    body: JSON.stringify(body),
  })
}

// ---------------------------------------------------------------------------
// C1
// ---------------------------------------------------------------------------

test('C1 runtime: anonymous caller is rejected before any Stripe lookup', async () => {
  state.company = null
  state.couponCalls = 0
  const { POST } = await import('../app/api/company/subscription/coupon/validate/route')
  const res = await POST(post('https://app.test/api/company/subscription/coupon/validate', { code: 'SAVE' }))
  assert.equal(res.status, 403)
  assert.equal(state.couponCalls, 0, 'Stripe not called for anonymous caller')
})

test('C1 runtime: authenticated Company reaches the existing coupon validation', async () => {
  state.company = { company: { id: 'company-1' }, user: { id: 'user-1' }, membership: {} }
  state.couponAllowed = true
  state.couponCalls = 0
  const { POST } = await import('../app/api/company/subscription/coupon/validate/route')
  const res = await POST(post('https://app.test/api/company/subscription/coupon/validate', { code: 'SAVE' }))
  assert.equal(res.status, 200)
  assert.equal(state.couponCalls, 1)
  const body = await res.json()
  assert.equal(body.valid, false)
  assert.equal('promotionCodeId' in body, false)
})

test('C1 runtime: distributed limiter blocks before any Stripe lookup', async () => {
  state.company = { company: { id: 'company-1' }, user: { id: 'user-1' }, membership: {} }
  state.couponAllowed = false
  state.couponCalls = 0
  const { POST } = await import('../app/api/company/subscription/coupon/validate/route')
  const res = await POST(post('https://app.test/api/company/subscription/coupon/validate', { code: 'SAVE' }))
  assert.equal(res.status, 429)
  assert.equal(state.couponCalls, 0, 'Stripe not called when rate limited')
})

// ---------------------------------------------------------------------------
// G1
// ---------------------------------------------------------------------------

test('G1 runtime: oversized geocode input is rejected before the Google call', async () => {
  state.geocodeCalls = 0
  const { POST } = await import('../app/api/location/geocode/route')
  const res = await POST(post('https://app.test/api/location/geocode', { address: 'a'.repeat(400) }))
  assert.equal(res.status, 400)
  assert.equal(state.geocodeCalls, 0)
})

test('G1 runtime: rate-limited geocode is rejected before the Google call', async () => {
  state.locationExceeded = true
  state.geocodeCalls = 0
  const { POST } = await import('../app/api/location/geocode/route')
  const res = await POST(post('https://app.test/api/location/geocode', { address: '1 Main St, Dallas, TX' }))
  assert.equal(res.status, 429)
  assert.equal(state.geocodeCalls, 0)
})

test('G1 runtime: a normal geocode still works and calls Google exactly once', async () => {
  state.locationExceeded = false
  state.geocodeCalls = 0
  const { POST } = await import('../app/api/location/geocode/route')
  const res = await POST(post('https://app.test/api/location/geocode', { address: '1 Main St, Dallas, TX' }))
  assert.equal(res.status, 200)
  assert.equal(state.geocodeCalls, 1)
  const body = await res.json()
  assert.equal(body.location.token, 'signed-token')
  assert.equal(JSON.stringify(body).includes('GOOGLE_MAPS'), false)
})

// ---------------------------------------------------------------------------
// P1
// ---------------------------------------------------------------------------

test('P1 runtime: dedup gate permits one write, suppresses repeats, and never throws', async () => {
  const { recordProfileView } = await import('../lib/profile-view')

  state.viewAllowed = true
  state.viewThrows = false
  state.increments = 0
  await recordProfileView('broker-1', 'ip:203.0.113.9')
  assert.equal(state.increments, 1, 'first view counts')

  state.viewAllowed = false
  await recordProfileView('broker-1', 'ip:203.0.113.9')
  assert.equal(state.increments, 1, 'deduped view does not write')

  state.viewAllowed = true
  state.viewThrows = true
  await assert.doesNotReject(recordProfileView('broker-2', 'ip:203.0.113.9'))
})
