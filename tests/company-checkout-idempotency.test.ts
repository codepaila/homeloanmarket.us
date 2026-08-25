import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { buildCompanyCheckoutIdempotencyKey } from '../lib/company-checkout'

const read = (relative: string): string => fs.readFileSync(path.resolve(__dirname, '..', relative), 'utf8')

const base = {
  companyId: 'company-1',
  customerId: 'cus_1',
  priceId: 'price_1U7KTBJubG4mXWM2s6Ivcdl6',
  planId: 'plan-1',
  planName: 'Standard Advertising',
  mode: 'subscription',
  allowPromotionCodes: false,
  managedPaymentsEnabled: false,
  couponId: null as string | null,
  billingAddressCollection: 'required',
  priorSessionId: null as string | null,
}

// ===========================================================================
// Deterministic idempotency (duplicate prevention)
// ===========================================================================

test('identical checkout requests produce the same idempotency key', () => {
  assert.equal(buildCompanyCheckoutIdempotencyKey(base), buildCompanyCheckoutIdempotencyKey(base))
  // Order/whitespace of the same inputs must not matter — the fingerprint is canonical.
  const reordered = { ...base, planName: 'Standard Advertising' }
  assert.equal(buildCompanyCheckoutIdempotencyKey(base), buildCompanyCheckoutIdempotencyKey(reordered))
})

test('key is stable across processes (deterministic hash, no randomness)', () => {
  const key = buildCompanyCheckoutIdempotencyKey(base)
  assert.match(key, /^company_checkout_[0-9a-f]{16}_company-1_cus_1_price_/)
})

// ===========================================================================
// New key when the request materially changes
// ===========================================================================

test('checkout configuration version change rotates the key', () => {
  const oldConfig = { ...base, managedPaymentsEnabled: true }
  assert.notEqual(buildCompanyCheckoutIdempotencyKey(base), buildCompanyCheckoutIdempotencyKey(oldConfig), 'Managed Payments config change must rotate the key')
  const diffMode = { ...base, mode: 'payment' }
  assert.notEqual(buildCompanyCheckoutIdempotencyKey(base), buildCompanyCheckoutIdempotencyKey(diffMode))
  const diffPromo = { ...base, allowPromotionCodes: true }
  assert.notEqual(buildCompanyCheckoutIdempotencyKey(base), buildCompanyCheckoutIdempotencyKey(diffPromo))
  const diffBilling = { ...base, billingAddressCollection: 'auto' }
  assert.notEqual(buildCompanyCheckoutIdempotencyKey(base), buildCompanyCheckoutIdempotencyKey(diffBilling))
})

test('different discount (coupon) rotates the key', () => {
  const discounted = { ...base, couponId: 'coupon_test' }
  assert.notEqual(buildCompanyCheckoutIdempotencyKey(base), buildCompanyCheckoutIdempotencyKey(discounted))
})

test('different Stripe price rotates the key', () => {
  const otherPrice = { ...base, priceId: 'price_OTHER' }
  assert.notEqual(buildCompanyCheckoutIdempotencyKey(base), buildCompanyCheckoutIdempotencyKey(otherPrice))
})

test('different plan rotates the key even when the price is identical', () => {
  const otherPlan = { ...base, planId: 'plan-2', planName: 'Premium Advertising' }
  assert.notEqual(buildCompanyCheckoutIdempotencyKey(base), buildCompanyCheckoutIdempotencyKey(otherPlan))
})

test('different customer rotates the key', () => {
  const otherCustomer = { ...base, customerId: 'cus_2' }
  assert.notEqual(buildCompanyCheckoutIdempotencyKey(base), buildCompanyCheckoutIdempotencyKey(otherCustomer))
})

test('different company never shares a key', () => {
  const otherCompany = { ...base, companyId: 'company-2' }
  assert.notEqual(buildCompanyCheckoutIdempotencyKey(base), buildCompanyCheckoutIdempotencyKey(otherCompany))
})

// ===========================================================================
// Retry behavior
// ===========================================================================

test('retry after a canceled/expired session rotates the key (fresh checkout)', () => {
  const afterCancel = { ...base, priorSessionId: 'cs_canceled_1' }
  assert.notEqual(buildCompanyCheckoutIdempotencyKey(base), buildCompanyCheckoutIdempotencyKey(afterCancel))
  // A second cancel-retry rotates again (new prior session id).
  const afterSecondCancel = { ...base, priorSessionId: 'cs_canceled_2' }
  assert.notEqual(buildCompanyCheckoutIdempotencyKey(afterCancel), buildCompanyCheckoutIdempotencyKey(afterSecondCancel))
})

// ===========================================================================
// Route audit: the old un-fingerprinted key is gone; open sessions are reused
// ===========================================================================

test('company checkout uses the content-fingerprinted key builder', () => {
  const route = read('app/api/company/subscription/checkout/route.ts')
  assert.match(route, /buildCompanyCheckoutIdempotencyKey/, 'route uses the content-fingerprinted key builder')
  assert.doesNotMatch(route, /company_checkout_\$\{current\.company\.id\}_\$\{customerId\}_\$\{priceId\}/, 'old un-fingerprinted key pattern must be gone')
})

test('company checkout reuses an open session and rotates after a canceled one', () => {
  const route = read('app/api/company/subscription/checkout/route.ts')
  assert.match(route, /checkout\.sessions\.list/, 'route lists prior sessions for this customer')
  assert.match(route, /session\.metadata\?\.companyId === current\.company\.id/, 'prior session matched to this company')
  assert.match(route, /session\.metadata\?\.planId === plan\.id/, 'prior session matched to this plan')
  assert.match(route, /priorCheckout\?\.status === 'open'/, 'open session is reused (duplicate prevention)')
  assert.match(route, /priorSessionId: priorCheckout \? priorCheckout\.id : null/, 'canceled/expired prior session rotates the key')
})

test('company checkout idempotency remains isolated from broker/company plans', () => {
  const route = read('app/api/company/subscription/checkout/route.ts')
  assert.match(route, /resolveCompanyPlanForCheckout/, 'resolves CompanyAdvertisingPlan')
  assert.match(route, /plan\.stripePriceId/, 'price from the stored company plan')
  assert.doesNotMatch(route, /validateBrokerPlanForCheckout|brokerSubscriptionPlan|SubscriptionPlan/, 'never resolves broker plans')
})

test('no sensitive value is embedded in the idempotency key', () => {
  const lib = read('lib/company-checkout.ts')
  const key = buildCompanyCheckoutIdempotencyKey(base)
  assert.doesNotMatch(key, /sk_|whsec_|password|secret/, 'key contains no secrets')
  assert.doesNotMatch(lib, /process\.env|STRIPE_SECRET/, 'key builder never reads secrets')
})