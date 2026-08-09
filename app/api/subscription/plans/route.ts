import { NextRequest, NextResponse } from 'next/server'
import { subscriptionPlans } from '@/lib/stripe'

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      success: true,
      plans: subscriptionPlans
    })
  } catch (error) {
    console.error('Error fetching subscription plans:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch subscription plans' },
      { status: 500 }
    )
  }
}