import { NextResponse } from 'next/server'
import { listBrokerPlansPublic } from '@/lib/broker-plans'

export async function GET() {
  try {
    // Public plans: active only, DB-backed, display-safe shape. Never trusts
    // client price/Stripe values.
    const plans = await listBrokerPlansPublic()
    return NextResponse.json({ success: true, plans })
  } catch (error) {
    console.error('Error fetching subscription plans:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch subscription plans' },
      { status: 500 }
    )
  }
}