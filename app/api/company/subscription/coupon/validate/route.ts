import { NextRequest, NextResponse } from 'next/server'
import { isSameOriginRequest } from '@/lib/origin'
import { validateCompanyCoupon } from '@/lib/company-coupon'

// Validates a customer-facing promotion code against Stripe (server-side,
// never trusted from the client). Only display-safe fields are returned; the
// internal Stripe promotion_code ID is never exposed to the browser. Pricing
// is never computed here — Stripe is the authoritative source at checkout.
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
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
