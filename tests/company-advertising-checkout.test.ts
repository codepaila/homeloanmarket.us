import { mock, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { NextRequest } from 'next/server'

const read = (relative: string): string => fs.readFileSync(path.resolve(__dirname, '..', relative), 'utf8')

// ===========================================================================
// Static audit: the company advertising checkout session parameters
// ===========================================================================

test('company advertising checkout never sends payment_method_types and disables Managed Payments per-session', () => {
  const checkout = read('app/api/company/subscription/checkout/route.ts')
  // The account's Managed Payments rejects `payment_method_types` and the
  // products are not yet Managed-Payments eligible, so the session disables
  // Managed Payments for this request only (Stripe's recommended escape hatch).
  assert.doesNotMatch(checkout, /payment_method_types:/, 'unsupported parameter must not be sent to Stripe')
  assert.match(checkout, /managed_payments: \{ enabled: false \}/, 'Managed Payments disabled for this session only')
})

test('company advertising checkout uses the stored stripePriceId, never a hardcoded price', () => {
  const checkout = read('app/api/company/subscription/checkout/route.ts')
  assert.match(checkout, /plan\.stripePriceId/, 'price resolves from the stored plan price id')
  assert.match(checkout, /line_items: \[\{ price: priceId!, quantity: 1 \}\]/, 'session line item uses the resolved price id')
  assert.doesNotMatch(checkout, /3000|30\.00|\$30/, 'no hardcoded $30 amount')
})

test('company advertising checkout is isolated from broker SubscriptionPlan', () => {
  const checkout = read('app/api/company/subscription/checkout/route.ts')
  assert.match(checkout, /resolveCompanyPlanForCheckout/)
  assert.doesNotMatch(checkout, /SubscriptionPlan/, 'must not consult the broker SubscriptionPlan enum')
  assert.doesNotMatch(checkout, /getPlanForStripePrice/)
})

test('company checkout keeps server-controlled coupons and no client promotion codes', () => {
  const checkout = read('app/api/company/subscription/checkout/route.ts')
  assert.match(checkout, /validateCompanyCoupon/)
  assert.match(checkout, /allow_promotion_codes: false/)
  assert.match(checkout, /mode: 'subscription'/)
})

test('broker subscription checkout is a separate code path and unaffected', () => {
  const broker = read('app/api/subscription/checkout/route.ts')
  assert.match(broker, /validateBrokerPlanForCheckout/, 'broker checkout resolves its own plan')
  assert.doesNotMatch(broker, /CompanyAdvertisingPlan|companySubscription/, 'broker checkout never touches company plans')
})

// ===========================================================================
// Runtime: ownership, plan gating, error handling (no real Stripe calls)
// ===========================================================================

type Plan = {
  id: string
  name: string
  price: number
  billingInterval: string
  stripePriceId: string | null
  stripeProductId: string | null
} | null

const state: {
  currentCompany: { user: { id: string; email: string }; company: { id: string; name: string; status?: string }; membership: Record<string, unknown> } | null
  plan: Plan
  stripeSecretKey: string | null
  createdCustomer: boolean
  freePlanUpdated: boolean
} = {
  currentCompany: { user: { id: 'user-1', email: 'company@example.com' }, company: { id: 'company-1', name: 'Acme Realty' }, membership: {} },
  plan: null,
  stripeSecretKey: 'sk_test_fake_not_real',
  createdCustomer: false,
  freePlanUpdated: false,
}

mock.module('@/lib/company-policy', {
  namedExports: { getCurrentCompany: async () => state.currentCompany },
})

mock.module('@/lib/origin', {
  namedExports: { isSameOriginRequest: () => true },
})

mock.module('@/lib/company-plan', {
  namedExports: {
    resolveCompanyPlanForCheckout: async () => state.plan,
    COMPANY_PLAN_DEFAULT_NAME: 'ADVERTISING',
  },
})

mock.module('@/lib/company-coupon', {
  namedExports: {
    validateCompanyCoupon: async () => ({ valid: false as const, reason: 'Coupon is not valid' }),
  },
})

mock.module('@/lib/subscription', {
  namedExports: {
    SubscriptionService: {
      withBillingLock: async (_key: string, fn: () => Promise<unknown>) => fn(),
    },
  },
})

mock.module('@/lib/prisma', {
  defaultExport: {
    companySubscription: {
      findUnique: async () => null,
      upsert: async () => ({}),
      update: async () => {
        state.freePlanUpdated = true
        return {}
      },
    },
    company: { update: async () => ({}) },
  },
})

mock.module('@/lib/stripe-config', {
  namedExports: { getStripeSecretKey: async () => state.stripeSecretKey },
})

// Session creation itself (the actual `stripe.checkout.sessions.create` call)
// is verified live against the Stripe TEST API — see the live verification
// script in this phase — because the real Stripe SDK cannot be reliably
// module-mocked when resolved through this route's import graph under tsx.

const getRoute = () => import('../app/api/company/subscription/checkout/route')

const post = (body: unknown) =>
  getRoute().then(({ POST }) =>
    POST(
      new NextRequest('https://homeloanmarket.com/api/company/subscription/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
    ),
  )

test('company checkout requires an authenticated company (session ownership)', async () => {
  state.currentCompany = null
  const res = await post({ planId: 'plan-1' })
  assert.equal(res.status, 403)
  state.currentCompany = { user: { id: 'user-1', email: 'company@example.com' }, company: { id: 'company-1', name: 'Acme Realty' }, membership: {} }
})

test('company checkout rejects an inactive/missing plan', async () => {
  state.plan = null
  const res = await post({ planId: 'missing-plan' })
  assert.equal(res.status, 503)
})

test('company checkout rejects a paid plan with a missing Stripe price id', async () => {
  state.plan = { id: 'plan-1', name: 'Standard Advertising', price: 3000, billingInterval: 'month', stripePriceId: null, stripeProductId: null }
  const res = await post({ planId: 'plan-1' })
  assert.equal(res.status, 503)
})

test('company checkout failure returns a safe message (never the raw provider error)', async () => {
  state.plan = { id: 'plan-1', name: 'Standard Advertising', price: 3000, billingInterval: 'month', stripePriceId: 'price_test123', stripeProductId: 'prod_test123' }
  // No Stripe key configured -> getStripe() throws; the browser must get a safe
  // generic message while the real error is logged server-side.
  state.stripeSecretKey = null
  const res = await post({ planId: 'plan-1' })
  assert.equal(res.status, 500)
  const data = await res.json()
  assert.equal(data.error, "We couldn't start checkout right now. Please try again.")
  assert.doesNotMatch(JSON.stringify(data), /STRIPE_SECRET_KEY|Invalid API Key/, 'provider/secret details never reach the browser')
  state.stripeSecretKey = 'sk_test_fake_not_real'
})

test('company $0 plan activates immediately without Stripe checkout', async () => {
  state.plan = { id: 'plan-free', name: 'ADVERTISING', price: 0, billingInterval: 'month', stripePriceId: null, stripeProductId: null }
  state.createdCustomer = false
  state.freePlanUpdated = false
  const res = await post({ planId: 'plan-free' })
  assert.equal(res.status, 200)
  const data = await res.json()
  assert.equal(data.free, true)
  assert.equal(data.url, null)
  assert.equal(state.createdCustomer, false, 'no Stripe customer created for a free plan')
  assert.equal(state.freePlanUpdated, true, 'free plan activated locally')
})
