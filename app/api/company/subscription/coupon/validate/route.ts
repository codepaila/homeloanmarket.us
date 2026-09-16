import { NextRequest, NextResponse } from 'next/server'
import { isSameOriginRequest, clientIp } from '@/lib/origin'
import { getCurrentCompany } from '@/lib/company-policy'
import { validateCompanyCoupon } from '@/lib/company-coupon'
import { companyCouponValidateRateLimit } from '@/lib/rateLimit'

// Validates a customer-facing promotion code against Stripe (server-side,
// never trusted from the client). Only display-safe fields are returned; the
// internal Stripe promotion_code ID is never exposed to the browser. Pricing
// is never computed here — Stripe is the authoritative source at checkout.
//
// This endpoint is exclusive to the Company Advertising product: it requires
// an authenticated, active, verified Company membership and rejects anonymous
// and non-company callers BEFORE any Stripe call. It is read-only with respect
// to billing state (it never activates/changes a subscription, never creates a
// Stripe subscription or Checkout Session). Checkout independently revalidates
// the coupon server-side before applying it.
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })

  // Company-authoritative authorization. Any active Company membership is
  // accepted, matching the existing Company billing authorization model
  // (checkout/cancel/portal also use getCurrentCompany()).
  const current = await getCurrentCompany()
  if (!current) return NextResponse.json({ error: 'Company access required' }, { status: 403 })

  // Distributed limiter BEFORE any Stripe call.
  try {
    const { success } = await companyCouponValidateRateLimit.limit(
      `company-coupon:${current.company.id}:${clientIp(request)}`,
    )
    if (!success) {
      return NextResponse.json(
        { valid: false, reason: 'Too many coupon attempts. Please try again later.' },
        { status: 429 },
      )
    }
  } catch {
    // Fail closed for provider-cost protection: if the limiter is unavailable
    // we cannot safely allow unbounded Stripe lookups.
    return NextResponse.json(
      { valid: false, reason: 'Coupon validation is temporarily unavailable' },
      { status: 503 },
    )
  }

  const body = await request.json().catch(() => ({}))
  const code = typeof body.code === 'string' ? body.code : ''
  const result = await validateCompanyCoupon(code)
  if (!result.valid) return NextResponse.json({ valid: false, reason: result.reason })
  // Return only display-safe fields; never expose the internal promotion_code ID.
  return NextResponse.json({
    valid: true,
    name: result.name,
    percentOff: result.percentOff,
    amountOff: result.amountOff,
    currency: result.currency,
  })
}
