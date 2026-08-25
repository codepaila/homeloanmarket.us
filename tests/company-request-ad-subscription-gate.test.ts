import { NextRequest } from 'next/server'
import { mock, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

// Regression coverage for the Request Advertisement subscription gate:
// only an ACTIVE CompanySubscription may create a CompanyAdRequest, and the
// rule must hold server-side even when the frontend is bypassed entirely.

const read = (path: string) => fs.readFileSync(path, 'utf8')

const gateState: {
  current: {
    user: { id: string; email: string }
    membership: Record<string, never>
    company: { id: string; name: string; onboardedAt?: Date | null; subscription?: { status: string; isActive: boolean } | null }
  } | null
  createdRequests: Array<{ data: Record<string, unknown> }>
} = {
  current: null,
  createdRequests: [],
}

mock.module('@/lib/company-policy', {
  namedExports: {
    getCurrentCompany: async () => gateState.current,
  },
})

mock.module('@/lib/origin', {
  namedExports: {
    isSameOriginRequest: () => true,
  },
})

mock.module('@/lib/prisma', {
  defaultExport: {
    companyAdRequest: {
      findMany: async () => [],
      create: async (args: { data: Record<string, unknown> }) => {
        gateState.createdRequests.push(args)
        return { id: 'req-abcdef12', ...args.data }
      },
    },
  },
})

const getRoute = () => import('../app/api/company/requests/route')

const post = (body: unknown) =>
  getRoute().then(({ POST }) =>
    POST(
      new NextRequest('https://homeloanmarket.com/api/company/requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
    ),
  )

function companyWith(subscription: { status: string; isActive: boolean } | null | undefined) {
  return {
    user: { id: 'user-1', email: 'company@example.com' },
    membership: {},
    // onboardedAt is intentionally omitted in most cases to prove the gate is
    // independent of onboarding completion (skipped onboarding).
    company: { id: 'company-1', name: 'Acme Realty', subscription },
  }
}

test('gate helper: only ACTIVE + isActive grants advertisement-request access', async () => {
  const { hasActiveCompanyAdvertisingSubscription } = await import('../lib/company-ad-access')
  assert.equal(hasActiveCompanyAdvertisingSubscription(null), false)
  assert.equal(hasActiveCompanyAdvertisingSubscription(undefined), false)
  assert.equal(hasActiveCompanyAdvertisingSubscription({ status: 'ACTIVE', isActive: true }), true)
  assert.equal(hasActiveCompanyAdvertisingSubscription({ status: 'ACTIVE', isActive: false }), false)
  assert.equal(hasActiveCompanyAdvertisingSubscription({ status: 'CHECKOUT_PENDING', isActive: false }), false)
  assert.equal(hasActiveCompanyAdvertisingSubscription({ status: 'PAST_DUE', isActive: false }), false)
  assert.equal(hasActiveCompanyAdvertisingSubscription({ status: 'CANCELED', isActive: false }), false)
  assert.equal(hasActiveCompanyAdvertisingSubscription({ status: 'EXPIRED', isActive: false }), false)
})

test('direct POST with NO subscription is rejected and creates nothing (API bypass)', async () => {
  const route = await getRoute()
  gateState.current = companyWith(null)
  gateState.createdRequests = []
  const res = await post({ requestDetails: 'sneaky direct API call' })
  assert.equal(res.status, 403)
  const data = await res.json()
  assert.equal(data.code, 'SUBSCRIPTION_REQUIRED')
  assert.equal(gateState.createdRequests.length, 0)
  assert.ok(route)
})

test('direct POST with CHECKOUT_PENDING subscription is rejected', async () => {
  gateState.current = companyWith({ status: 'CHECKOUT_PENDING', isActive: false })
  gateState.createdRequests = []
  const res = await post({ requestDetails: 'too early' })
  assert.equal(res.status, 403)
  assert.equal((await res.json()).code, 'SUBSCRIPTION_REQUIRED')
  assert.equal(gateState.createdRequests.length, 0)
})

test('direct POST with CANCELED / EXPIRED / PAST_DUE subscriptions is rejected', async () => {
  for (const status of ['CANCELED', 'EXPIRED', 'PAST_DUE']) {
    gateState.current = companyWith({ status, isActive: false })
    gateState.createdRequests = []
    const res = await post({ requestDetails: `status ${status}` })
    assert.equal(res.status, 403, `${status} must be rejected`)
    assert.equal((await res.json()).code, 'SUBSCRIPTION_REQUIRED')
    assert.equal(gateState.createdRequests.length, 0, `${status} must not create a request`)
  }
})

test('ACTIVE flag without ACTIVE status is rejected (defense in depth)', async () => {
  gateState.current = companyWith({ status: 'CHECKOUT_PENDING', isActive: true })
  gateState.createdRequests = []
  const res = await post({ requestDetails: 'inconsistent state' })
  assert.equal(res.status, 403)
  assert.equal(gateState.createdRequests.length, 0)
})

test('skipped onboarding + no subscription → rejected; dashboard access unaffected', async () => {
  gateState.current = { ...companyWith(null), company: { id: 'company-1', name: 'Acme Realty', onboardedAt: null, subscription: null } }
  gateState.createdRequests = []
  const res = await post({ requestDetails: 'onboarding skipped, no sub' })
  assert.equal(res.status, 403)
  assert.equal(gateState.createdRequests.length, 0)
})

test('skipped onboarding + ACTIVE subscription → allowed', async () => {
  gateState.current = {
    ...companyWith({ status: 'ACTIVE', isActive: true }),
    company: { id: 'company-1', name: 'Acme Realty', onboardedAt: null, subscription: { status: 'ACTIVE', isActive: true } },
  }
  gateState.createdRequests = []
  const res = await post({ requestDetails: 'banner in Dallas', location: { locationLabel: 'Dallas, TX', radiusMiles: 25 } })
  assert.equal(res.status, 201)
  const data = await res.json()
  assert.equal(data.success, true)
  assert.equal(gateState.createdRequests.length, 1)
  assert.equal(gateState.createdRequests[0].data.companyId, 'company-1')
  assert.equal(gateState.createdRequests[0].data.requestedById, 'user-1')
})

test('unauthenticated caller cannot create a request regardless of body', async () => {
  gateState.current = null
  gateState.createdRequests = []
  const res = await post({ requestDetails: 'anonymous' })
  assert.equal(res.status, 403)
  assert.equal(gateState.createdRequests.length, 0)
})

test('route enforces the subscription gate before creating the request', () => {
  const api = read('app/api/company/requests/route.ts')
  const guardIndex = api.indexOf('hasActiveCompanyAdvertisingSubscription')
  const createIndex = api.indexOf('companyAdRequest.create')
  assert.ok(guardIndex > -1, 'subscription gate present in POST handler')
  assert.ok(createIndex > -1)
  assert.ok(guardIndex < createIndex, 'gate must run before request creation')
  assert.match(api, /SUBSCRIPTION_REQUIRED/)
  assert.doesNotMatch(api, /[Bb]rokerSubscription|SubscriptionPlan[^S]/, 'must not consult broker subscription tables')
})

test('dashboard Request Advertisement UI reflects the subscription state', () => {
  const client = read('app/company/dashboard/CompanyDashboardClient.tsx')
  assert.match(client, /hasActiveCompanyAdvertisingSubscription/, 'UI shares the server-side gate rule')
  assert.match(client, /Advertising subscription required/)
  assert.match(client, /Start advertising subscription/)
  assert.match(client, /Subscription confirmation in progress/)
})
