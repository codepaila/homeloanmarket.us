import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (p: string) => fs.readFileSync(p, 'utf8')
const brokerCheckout = read('app/api/subscription/checkout/route.ts')
const brokerRegCheckout = read('app/api/broker-registration/subscription/checkout/route.ts')
const brokerPlans = read('lib/broker-plans.ts')
const subscriptionService = read('lib/subscription.ts')
const emailActions = read('actions/email.action.ts')
const companyCheckout = read('app/api/company/subscription/checkout/route.ts')
const companyCoupon = read('lib/company-coupon.ts')

// ===========================================================================
// PHASE 8.36.10.1 — BROKER BILLING HAS NO COUPON / PROMOTION / DISCOUNT PATH
//
// Business rule: coupons are ONLY for the Company Advertising product. The
// broker (mortgage originator) product — BrokerSubscription, FEATURED, FREE,
// and broker registration — must never accept, validate, or pass coupons /
// promotion codes / discounts to Stripe.
// ===========================================================================

test('broker FEATURED checkout does not accept coupons or promotion codes', () => {
  assert.doesNotMatch(brokerCheckout, /coupon/i)
  assert.doesNotMatch(brokerCheckout, /promotion/i)
  assert.doesNotMatch(brokerCheckout, /allow_promotion_codes/)
  assert.doesNotMatch(brokerCheckout, /discounts/)
})

test('broker checkout does not import or call company coupon helpers', () => {
  assert.doesNotMatch(brokerCheckout, /company-coupon/)
  assert.doesNotMatch(brokerCheckout, /validateCompanyCoupon/)
  assert.doesNotMatch(brokerCheckout, /resolveCompanyPromotionCode/)
})

test('broker checkout uses the authoritative database plan price, never a discount', () => {
  assert.match(brokerCheckout, /validateBrokerPlanForCheckout/)
  assert.match(brokerCheckout, /checkoutPlan\.plan\.stripePriceId/)
  assert.doesNotMatch(brokerCheckout, /price\s*[-+*/]|discount/i)
})

test('broker registration checkout has no coupon behavior', () => {
  assert.doesNotMatch(brokerRegCheckout, /coupon/i)
  assert.doesNotMatch(brokerRegCheckout, /promotion/i)
  assert.doesNotMatch(brokerRegCheckout, /allow_promotion_codes/)
  assert.doesNotMatch(brokerRegCheckout, /discounts/)
})

test('broker subscription service and plan contract have no coupon logic', () => {
  assert.doesNotMatch(subscriptionService, /coupon/i)
  assert.doesNotMatch(subscriptionService, /promotion/i)
  assert.doesNotMatch(brokerPlans, /coupon/i)
  assert.doesNotMatch(brokerPlans, /promotion/i)
})

test('broker purchase email does not assume or display discounts', () => {
  assert.doesNotMatch(emailActions, /coupon/i)
  assert.doesNotMatch(emailActions, /promotion/i)
  assert.doesNotMatch(emailActions, /discount/i)
})

// ===========================================================================
// Company Advertising coupons remain intact and isolated.
// ===========================================================================

test('company checkout still supports coupons via its own coupon helper', () => {
  assert.match(companyCheckout, /validateCompanyCoupon/)
  assert.match(companyCheckout, /discounts: \[\{ promotion_code/)
  assert.match(companyCheckout, /allow_promotion_codes: false/)
  assert.match(companyCoupon, /export async function validateCompanyCoupon/)
  assert.match(companyCoupon, /export async function resolveCompanyPromotionCode/)
})

test('no cross-product coupon dependency: broker checkout never shares company coupon state', () => {
  assert.doesNotMatch(brokerCheckout, /company/i)
  assert.doesNotMatch(brokerCheckout, /stripePromotionCodeId/)
})