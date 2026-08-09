import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import Stripe from 'stripe'
import { SubscriptionService } from '@/lib/subscription'
import { validatePlanPrice } from '@/lib/stripe'
import { SubscriptionPlan } from '@prisma/client'
import { getCorrelationId } from '@/lib/correlation'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

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
        { status: 403 }
      )
    }

    const body = await request.json()
    const { priceId, plan } = body

    if (!priceId || !plan) {
      return NextResponse.json(
        { success: false, error: 'Price ID and plan are required' },
        { status: 400 }
      )
    }
    const targetPlan = validatePlanPrice(plan, priceId)
    if (!targetPlan) return NextResponse.json({ success: false, error: 'Invalid subscription plan or price' }, { status: 400 })
    const upgradeCheck = await SubscriptionService.canUpgrade(user.brokerProfile.id, targetPlan.name as SubscriptionPlan)
    if (!upgradeCheck.canUpgrade) return NextResponse.json({ success: false, error: upgradeCheck.reason }, { status: 409 })

    if (!user.subscriptionId) {
      return NextResponse.json(
        { success: false, error: 'No active subscription found' },
        { status: 400 }
      )
    }

    // Get current subscription
    const subscription = await stripe.subscriptions.retrieve(user.subscriptionId)
    if (subscription.customer !== user.stripeCustomerId) {
      return NextResponse.json({ success: false, error: 'Subscription customer does not match account' }, { status: 403 })
    }

    // Update subscription with new price
    const updatedSubscription = await stripe.subscriptions.update(user.subscriptionId, {
      cancel_at_period_end: false,
      items: [{
        id: subscription.items.data[0].id,
        price: priceId,
      }],
      proration_behavior: 'create_prorations',
      metadata: {
        ...subscription.metadata,
        plan: plan,
        upgradedAt: new Date().toISOString()
      }
    })

    // Reconcile from Stripe so local entitlement is not granted ahead of
    // authoritative subscription status.
    await SubscriptionService.syncWithStripe(user.brokerProfile.id)

    console.info('Subscription upgraded', { correlationId, brokerId: user.brokerProfile.id, plan: targetPlan.name })

    return NextResponse.json({
      success: true,
      subscriptionId: updatedSubscription.id,
      message: 'Plan upgraded successfully'
    })
  } catch (error: unknown) {
    console.error('Error upgrading subscription', { correlationId: getCorrelationId(request), error: error instanceof Error ? error.message : 'Unknown error' })
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to upgrade subscription'
      },
      { status: 500 }
    )
  }
}
