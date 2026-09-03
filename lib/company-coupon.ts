import Stripe from 'stripe'
import { getStripeSecretKey } from '@/lib/stripe-config'

// Customer-facing promotion codes are resolved through Stripe Promotion Codes
// (backed by Stripe Coupons). The client may only supply a plain code string;
// the server resolves it to a Stripe promotion_code ID and hands that to
// Checkout's `discounts: [{ promotion_code }]` so Stripe — not this app —
// authoritatively validates the code (active state, expiration, redemption
// limit, customer eligibility, minimum amount, product restrictions) and
// computes the discount.
export type CompanyCouponResult =
  | {
      valid: true
      /** Stripe promotion_code ID (server-side only, never returned to a client). */
      promotionCodeId: string
      /** Display-only fields for optional client rendering (never used for pricing). */
      name: string | null
      percentOff: number | null
      amountOff: number | null
      currency: string | null
    }
  | { valid: false; reason: string }

// Resolves a customer-facing code string to an active Stripe Promotion Code.
// Fails closed on any error (network, missing key, etc.) so an invalid or
// unusable code never reaches Checkout. Server-side only.
export async function resolveCompanyPromotionCode(code: string): Promise<Stripe.PromotionCode | null> {
  const normalized = code.trim()
  if (!normalized) return null
  const secretKey = await getStripeSecretKey()
  if (!secretKey) return null

  const stripe = new Stripe(secretKey)
  // list({ code }) matches the customer-facing code case-insensitively.
  const codes = await stripe.promotionCodes.list({ code: normalized, limit: 100 })
  // Only consider codes that Stripe reports as currently active. Any expired,
  // maxed-out, or customer-restricted code is `active: false`.
  return codes.data.find((promotionCode) => promotionCode.active && promotionCode.code === normalized) || null
}

// Validates a customer-facing promotion code. Never trusts the client; never
// reproduces Stripe's pricing locally.
export async function validateCompanyCoupon(code: string): Promise<CompanyCouponResult> {
  try {
    const promotionCode = await resolveCompanyPromotionCode(code)
    if (!promotionCode) return { valid: false, reason: 'This promotion code is not valid' }

    const secretKey = await getStripeSecretKey()
    if (!secretKey) return { valid: false, reason: 'This promotion code is not valid' }
    const stripe = new Stripe(secretKey)

    const rawCoupon = promotionCode.promotion?.coupon
    const coupon =
      typeof rawCoupon === 'string' ? await stripe.coupons.retrieve(rawCoupon) : (rawCoupon as Stripe.Coupon | null)
    if (!coupon || coupon.valid !== true) return { valid: false, reason: 'This promotion code is not valid' }

    return {
      valid: true,
      promotionCodeId: promotionCode.id,
      name: coupon.name ?? null,
      percentOff: coupon.percent_off ?? null,
      amountOff: coupon.amount_off ?? null,
      currency: coupon.currency ?? null,
    }
  } catch {
    return { valid: false, reason: 'This promotion code is not valid' }
  }
}
