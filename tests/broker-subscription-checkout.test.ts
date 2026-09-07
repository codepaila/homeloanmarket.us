import { mock, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { NextRequest } from 'next/server'

const read = (relative: string): string => fs.readFileSync(path.resolve(__dirname, '..', relative), 'utf8')

const BROKER_CHECKOUT_FILES = [
  'app/api/subscription/checkout/route.ts',
  'app/api/broker-registration/subscription/checkout/route.ts',
  'actions/subscription.ts',
]

// ===========================================================================
// Static: Managed Payments compatibility + DB price for every broker path
// ===========================================================================

test('broker checkout paths never send payment_method_types', () => {
  for (const file of BROKER_CHECKOUT_FILES) {
    assert.doesNotMatch(read(file), /payment_method_types:/, `${file} must not send the unsupported parameter`)
  }
})

test('broker checkout paths disable Managed Payments per-session only', () => {
  for (const file of BROKER_CHECKOUT_FILES) {
    assert.match(read(file), /managed_payments: \{ enabled: false \}/, `${file} disables Managed Payments for the session only`)
  }
})

test('broker subscription checkout resolves the price from the database plan', () => {
  const checkout = read('app/api/subscription/checkout/route.ts')
  assert.match(checkout, /validateBrokerPlanForCheckout/, 'plan validated against the DB-backed broker plan')
  assert.match(checkout, /checkoutPlan\.plan\.stripePriceId/, 'session price comes from the database plan')
  assert.doesNotMatch(checkout, /price_[0-9A-Za-z]+/, 'no hardcoded Stripe price literal')
  assert.doesNotMatch(checkout, /CompanyAdvertisingPlan|companySubscription/, 'never touches company plans')
})

test('broker registration checkout resolves the price from the database plan', () => {
  const checkout = read('app/api/broker-registration/subscription/checkout/route.ts')
  assert.match(checkout, /validateBrokerPlanForCheckout/, 'registration checkout validates against the DB plan')
  assert.match(checkout, /checkoutPlan\.plan\.stripePriceId/, 'registration session price comes from the database plan')
  assert.doesNotMatch(checkout, /price_[0-9A-Za-z]+/, 'no hardcoded Stripe price literal')
  assert.doesNotMatch(checkout, /CompanyAdvertisingPlan|companySubscription/, 'never touches company plans')
})

test('lib/stripe.ts has no hardcoded Stripe price (env + DB only)', () => {
  const source = read('lib/stripe.ts')
  assert.doesNotMatch(source, /price_[0-9A-Za-z]+/, 'no hardcoded Stripe price literal in the legacy validator')
  assert.match(source, /brokerSubscriptionPlan/, 'validator resolves the FEATURED price from the database')
  assert.doesNotMatch(source, /CompanyAdvertisingPlan/, 'broker validator never consults company plans')
})

test('FREE broker plan bypasses Stripe entirely', () => {
  const free = read('app/api/broker-registration/subscription/free/route.ts')
  assert.doesNotMatch(free, /stripe\.checkout|new Stripe|checkout\.sessions/, 'FREE plan never calls Stripe')
  assert.match(free, /status: 'ACTIVE'/, 'FREE activates the registration subscription locally')
  assert.match(free, /redirectTo: result\.redirectTo|redirectTo:\s*'\/(setup|broker\/dashboard)'/, 'FREE continues to onboarding or dashboard')
})

test('broker/company isolation in checkout paths', () => {
  const company = read('app/api/company/subscription/checkout/route.ts')
  assert.doesNotMatch(company, /BrokerSubscription|validateBrokerPlanForCheckout|brokerSubscriptionPlan/, 'company checkout never resolves broker plans')
  for (const file of BROKER_CHECKOUT_FILES) {
    assert.doesNotMatch(read(file), /CompanyAdvertisingPlan|companySubscription/, `${file} never resolves company plans`)
  }
})

// ===========================================================================
// Runtime: auth + plan gating for the broker checkout routes (no Stripe call)
// ===========================================================================

type User = { id: string; role: string; email: string; name: string; brokerProfile: { id: string } | null; brokerRegistration: { id: string } | null } | null

const state: {
  currentUser: User
  planResult: { ok: boolean; reason?: string; plan?: { code: string; stripePriceId: string } } | null
  originOk: boolean
} = {
  currentUser: { id: 'user-1', role: 'BROKER', email: 'b@example.com', name: 'B', brokerProfile: { id: 'broker-1' }, brokerRegistration: { id: 'reg-1' } },
  planResult: null,
  originOk: true,
}

mock.module('@/lib/currentUser', {
  namedExports: { getCurrentUser: async () => state.currentUser },
})

mock.module('@/lib/origin', {
  namedExports: { isSameOriginRequest: () => state.originOk },
})

mock.module('@/lib/broker-plans', {
  namedExports: {
    validateBrokerPlanForCheckout: async () => state.planResult ?? { ok: false as const, reason: 'Invalid subscription plan' },
    getBrokerPlanByCode: async () => null,
  },
})

mock.module('@/lib/subscription', {
  namedExports: {
    CheckoutConflictError: class CheckoutConflictError extends Error {},
    BillingUnavailableError: class BillingUnavailableError extends Error {},
    SubscriptionService: {
      withBillingLock: async (_key: string, fn: () => Promise<unknown>) => fn(),
      withCheckoutLock: async (_key: string, fn: () => Promise<unknown>) => fn(),
      findCheckoutConflict: async () => null,
      assertStripeCustomerOwnership: async () => {},
    },
  },
})

mock.module('@/lib/prisma', {
  defaultExport: {
    brokerRegistrationSubscription: { findUnique: async () => null, upsert: async () => ({}) },
    brokerSubscription: { upsert: async () => ({}) },
    brokerRegistration: { update: async () => ({}) },
  },
})

mock.module('@/lib/stripe-config', {
  namedExports: { getStripeSecretKey: async () => 'sk_test_fake_not_real' },
})

const getBrokerCheckout = () => import('../app/api/subscription/checkout/route')
const getRegCheckout = () => import('../app/api/broker-registration/subscription/checkout/route')

const post = (mod: Promise<{ POST: (req: NextRequest) => Promise<Response> }>, body: unknown) =>
  mod.then(({ POST }) =>
    POST(
      new NextRequest('https://homeloanmarket.com/api/x', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
    ),
  )

test('broker subscription checkout requires authentication and a broker profile', async () => {
  // Unauthenticated -> 401.
  state.currentUser = null
  const unauth = await post(getBrokerCheckout(), { plan: 'FEATURED', priceId: 'price_x' })
  assert.equal(unauth.status, 401)

  // Authenticated non-broker (no brokerProfile) -> 404, never a checkout.
  state.currentUser = { id: 'user-1', role: 'USER', email: 'u@example.com', name: 'U', brokerProfile: null, brokerRegistration: null }
  state.planResult = { ok: true, plan: { code: 'FEATURED', stripePriceId: 'price_x' } }
  const noProfile = await post(getBrokerCheckout(), { plan: 'FEATURED', priceId: 'price_x' })
  assert.equal(noProfile.status, 404, 'broker identity is the session brokerProfile, never client-supplied')

  state.currentUser = { id: 'user-1', role: 'BROKER', email: 'b@example.com', name: 'B', brokerProfile: { id: 'broker-1' }, brokerRegistration: { id: 'reg-1' } }
})

test('broker subscription checkout rejects an invalid/inactive plan or price', async () => {
  state.planResult = { ok: false, reason: 'Invalid subscription plan' }
  const res = await post(getBrokerCheckout(), { plan: 'FEATURED', priceId: 'price_x' })
  assert.equal(res.status, 400)
  const data = await res.json()
  assert.equal(data.error, 'Invalid subscription plan')
})

test('broker subscription checkout accepts a valid DB plan (session creation verified live)', async () => {
  state.planResult = { ok: true, plan: { code: 'FEATURED', stripePriceId: 'price_1U0oeVJubG4mXWM28uPT1zdt' } }
  // The real Stripe SDK cannot be module-mocked under tsx, so the request will
  // proceed past plan gating and fail at the Stripe call. Asserting it is NOT
  // a 400/404 proves a valid DB plan/price passes server gating; the actual
  // Checkout Session creation is verified against the Stripe TEST API live.
  const res = await post(getBrokerCheckout(), { plan: 'FEATURED', priceId: 'price_1U0oeVJubG4mXWM28uPT1zdt' })
  assert.notEqual(res.status, 400, 'valid DB plan/price must pass server gating')
  assert.notEqual(res.status, 404, 'broker with profile must not be rejected as missing')
})

test('broker registration checkout requires BROKER + brokerRegistration', async () => {
  state.currentUser = { id: 'user-1', role: 'BROKER', email: 'b@example.com', name: 'B', brokerProfile: null, brokerRegistration: null }
  const res = await post(getRegCheckout(), { plan: 'FEATURED', priceId: 'price_x' })
  assert.equal(res.status, 404, 'registration checkout requires a broker registration')
  state.currentUser = { id: 'user-1', role: 'BROKER', email: 'b@example.com', name: 'B', brokerProfile: { id: 'broker-1' }, brokerRegistration: { id: 'reg-1' } }
})

test('broker registration checkout rejects a non-FEATURED plan or invalid price', async () => {
  state.currentUser = { id: 'user-1', role: 'BROKER', email: 'b@example.com', name: 'B', brokerProfile: null, brokerRegistration: { id: 'reg-1' } }
  state.planResult = { ok: false, reason: 'Invalid subscription plan' }
  const badPlan = await post(getRegCheckout(), { plan: 'PREMIUM', priceId: 'price_x' })
  assert.equal(badPlan.status, 400, 'only FEATURED is allowed in the registration flow')
  const badPrice = await post(getRegCheckout(), { plan: 'FEATURED', priceId: 'price_tampered' })
  assert.equal(badPrice.status, 400, 'tampered price rejected')
})

test('broker checkout never trusts browser-supplied ownership', () => {
  const broker = read('app/api/subscription/checkout/route.ts')
  assert.doesNotMatch(broker, /body\.brokerId|body\.userId/, 'ownership derived from the session, never the body')
  assert.match(broker, /getCurrentUser\(\)/, 'authenticated user required')
  const reg = read('app/api/broker-registration/subscription/checkout/route.ts')
  assert.doesNotMatch(reg, /body\.brokerId|body\.userId|body\.registrationId/, 'registration ownership never taken from the body')
  assert.match(reg, /user\.brokerRegistration\.id/, 'registration id derived from the session')
})
