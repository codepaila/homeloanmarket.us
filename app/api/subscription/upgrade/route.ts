import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import Stripe from 'stripe'
import { BillingUnavailableError, CheckoutConflictError, SubscriptionService } from '@/lib/subscription'
import { validateBrokerPlanForCheckout } from '@/lib/broker-plans'
import { getCorrelationId } from '@/lib/correlation'
import { getStripeSecretKey } from '@/lib/stripe-config'

async function getStripe(): Promise<Stripe> {
  const key = await getStripeSecretKey()
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured')
  return new Stripe(key)
}

export async function POST(request: NextRequest) {
  try {
    const stripe = await getStripe()
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
    const checkoutPlan = await validateBrokerPlanForCheckout(String(plan), String(priceId))
    if (!checkoutPlan.ok) return NextResponse.json({ success: false, error: checkoutPlan.reason }, { status: 400 })
    const upgradeCheck = await SubscriptionService.canUpgrade(user.brokerProfile.id, checkoutPlan.plan.code)
    if (!upgradeCheck.canUpgrade) return NextResponse.json({ success: false, error: upgradeCheck.reason }, { status: 409 })

    if (!user.subscriptionId) {
      return NextResponse.json(
        { success: false, error: 'No active subscription found' },
        { status: 400 }
      )
    }

    const updatedSubscription = await SubscriptionService.withCheckoutLock(user.brokerProfile.id, async () => {
      // Get current subscription
      const subscription = await stripe.subscriptions.retrieve(user.subscriptionId!)
      if (subscription.customer !== user.stripeCustomerId) {
        throw new Error('Subscription customer does not match account')
      }

      // Update subscription with new price
      const updated = await stripe.subscriptions.update(user.subscriptionId!, {
        cancel_at_period_end: false,
        items: [{
          id: subscription.items.data[0].id,
          price: priceId,
        }],
        proration_behavior: 'create_prorations',
        metadata: {
          ...subscription.metadata,
          plan: checkoutPlan.plan.code,
        }
      }, {
        idempotencyKey: `upgrade_${user.id}_${subscription.id}_${priceId}`,
      })

      // Reconcile from Stripe so local entitlement is not granted ahead of
      // authoritative subscription status.
      await SubscriptionService.syncWithStripe(user.brokerProfile!.id)
      return updated
    })

    console.info('Subscription upgraded', { correlationId, brokerId: user.brokerProfile.id, plan: checkoutPlan.plan.code })

    return NextResponse.json({
      success: true,
      subscriptionId: updatedSubscription.id,
      message: 'Plan upgraded successfully'
    })
  } catch (error: unknown) {
    console.error('Error upgrading subscription', { correlationId: getCorrelationId(request), error: error instanceof Error ? error.message : 'Unknown error' })
    if (error instanceof CheckoutConflictError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 409 })
    }
    if (error instanceof BillingUnavailableError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 503 })
    }
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to upgrade subscription'
      },
      { status: 500 }
    )
  }
}
