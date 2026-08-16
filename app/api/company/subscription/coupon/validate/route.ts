import { NextRequest, NextResponse } from 'next/server'
import { isSameOriginRequest } from '@/lib/origin'
import { validateCompanyCoupon } from '@/lib/company-coupon'

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  const code = typeof body.code === 'string' ? body.code : ''
  const result = await validateCompanyCoupon(code)
  return NextResponse.json(result)
}
