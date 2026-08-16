import Stripe from 'stripe'

export type CompanyCouponResult =
  | { valid: true; id: string; name: string | null; percentOff: number | null; amountOff: number | null; currency: string | null }
  | { valid: false; reason: string }

// Reuses Stripe promotion-code/coupon infrastructure for company advertising
// plans. Coupons are validated server-side against Stripe (never trusted from
// the client); a paid plan without a configured Stripe key fails closed.
export async function validateCompanyCoupon(code: string): Promise<CompanyCouponResult> {
  const normalized = code.trim()
  if (!normalized) return { valid: false, reason: 'Coupon code is required' }
  if (!process.env.STRIPE_SECRET_KEY) return { valid: false, reason: 'Coupon validation is unavailable' }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  try {
    const coupon = await stripe.coupons.retrieve(normalized)
    if (!coupon.valid) return { valid: false, reason: 'Coupon is not valid' }
    return {
      valid: true,
      id: coupon.id,
      name: coupon.name ?? null,
      percentOff: coupon.percent_off ?? null,
      amountOff: coupon.amount_off ?? null,
      currency: coupon.currency ?? null,
    }
  } catch {
    return { valid: false, reason: 'Coupon is not valid' }
  }
}
