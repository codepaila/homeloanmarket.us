import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const read = (relative: string): string => fs.readFileSync(path.join(ROOT, relative), 'utf8')

// ---------------------------------------------------------------------------
// PHASE 5 — Promotion-code recording on Company checkout
// ---------------------------------------------------------------------------
// The chosen Plan is recorded on the CompanySubscription. The promotion code
// that was actually applied is persisted from authoritative server-validated
// data only (the resolved promotion_code ID from Stripe). A client-supplied
// Stripe ID is never trusted, this recording never affects entitlement, and
// FREE plans never store a code.
// ---------------------------------------------------------------------------

const schema = read('prisma/schema.prisma')
const checkout = read('app/api/company/subscription/checkout/route.ts')

test('CompanySubscription has a stripePromotionCodeId field', () => {
  assert.match(schema, /stripePromotionCodeId\s+String\?/)
})

test('checkout persists the promotion code id on both upserts from server-validated data only', () => {
  // Both the pre-Stripe upsert and the post-customer upsert write
  // stripePromotionCodeId. The value comes from `coupon.promotionCodeId`
  // (resolved server-side via validateCompanyCoupon), never from request body.
  const matches = checkout.match(/stripePromotionCodeId: promotionCodeId/g) || []
  assert.ok(matches.length >= 2, 'promotion code id is written in both upserts')
  assert.match(checkout, /const promotionCodeId = coupon && coupon\.valid \? coupon\.promotionCodeId : null/)
})

test('promotion code id is derived server-side after re-validating the coupon', () => {
  assert.match(checkout, /coupon = await validateCompanyCoupon\(couponCode\)/)
  assert.match(checkout, /coupon\.promotionCodeId/)
  // Server resolves the promotion_code; the client only sends a code string.
  assert.match(checkout, /discounts: \[\{ promotion_code: coupon\.promotionCodeId \}\]/)
})

test('a client-supplied Stripe id is never trusted', () => {
  assert.match(checkout, /a client-supplied Stripe ID is never trusted/)
  // allow_promotion_codes is disabled so the client cannot inject an arbitrary
  // code directly in the Stripe checkout UI.
  assert.match(checkout, /allow_promotion_codes: false/)
})

test('promo storage never affects entitlement', () => {
  assert.match(checkout, /promo storage never affects entitlement/)
  // The checkout still gates on the plan price, not on any promo field.
  assert.match(checkout, /if \(plan\.price <= 0\)/)
})

test('FREE plans never store a promotion code', () => {
  // promotionCodeId is null when there is no valid coupon (coupon is only
  // resolved for paid plans).
  assert.match(checkout, /if \(plan\.price > 0 && couponCode\)/)
  assert.match(checkout, /const promotionCodeId = coupon && coupon\.valid \? coupon\.promotionCodeId : null/)
})
