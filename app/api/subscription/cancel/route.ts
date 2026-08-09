import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import { SubscriptionService } from '@/lib/subscription'
import { getCorrelationId } from '@/lib/correlation'

export async function POST(request: NextRequest) {
  try {
    const correlationId = getCorrelationId(request)
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!user.brokerProfile) {
      return NextResponse.json(
        { success: false, error: 'Broker profile not found' },
        { status: 404 }
      )
    }

    await SubscriptionService.cancelSubscription(user.brokerProfile.id)

    console.info('Subscription cancelled', { correlationId, brokerId: user.brokerProfile.id })

    return NextResponse.json({
      success: true,
      message: 'Subscription cancelled successfully'
    })
  } catch (error: unknown) {
    console.error('Error cancelling subscription', { correlationId: getCorrelationId(request), error: error instanceof Error ? error.message : 'Unknown error' })
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to cancel subscription' },
      { status: 500 }
    )
  }
}
