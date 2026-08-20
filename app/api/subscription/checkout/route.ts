import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import prisma from '@/lib/prisma'
import Stripe from 'stripe'
import { getCorrelationId } from '@/lib/correlation'
import { BillingUnavailableError, CheckoutConflictError, SubscriptionService } from '@/lib/subscription'
import { validateBrokerPlanForCheckout } from '@/lib/broker-plans'
import { getStripeSecretKey } from '@/lib/stripe-config'

async function getStripe(): Promise<Stripe> {
  const key = await getStripeSecretKey()
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured')
  return new Stripe(key)
}

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

    const { priceId, plan } = await request.json()
    
    if (!priceId || !plan) {
      return NextResponse.json(
        { success: false, error: 'Price ID and plan are required' },
        { status: 400 }
      )
    }
    const checkoutPlan = await validateBrokerPlanForCheckout(String(plan), String(priceId))
    if (!checkoutPlan.ok) {
      return NextResponse.json({ success: false, error: checkoutPlan.reason }, { status: 400 })
    }

    if (!user.brokerProfile) {
      return NextResponse.json(
        { success: false, error: 'Broker profile not found' },
        { status: 404 }
      )
    }

    const checkoutSession = await SubscriptionService.withCheckoutLock(user.brokerProfile.id, async () => {
      const stripe = await getStripe()
      let customerId = user.stripeCustomerId
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email || undefined,
          name: user.name || undefined,
          metadata: {
            userId: user.id,
            brokerId: user.brokerProfile!.id
          }
        }, {
          idempotencyKey: `stripe_customer_${user.id}`,
        })
        customerId = customer.id

        await prisma.brokerSubscription.upsert({
          where: { brokerId: user.brokerProfile!.id },
          update: { stripeCustomerId: customerId },
          create: {
            brokerId: user.brokerProfile!.id,
            plan: 'FREE',
            isActive: false,
            stripeCustomerId: customerId
          }
        })
      } else {
        await SubscriptionService.assertStripeCustomerOwnership(user.id, user.brokerProfile!.id, customerId)
      }

      if (!customerId) throw new Error('Stripe customer unavailable')

      const conflict = await SubscriptionService.findCheckoutConflict(user.brokerProfile!.id, customerId)
      if (conflict?.checkoutUrl) return { url: conflict.checkoutUrl }
      if (conflict) throw new CheckoutConflictError(conflict.reason || 'Checkout is unavailable')

      const idempotencyKey = `checkout_${user.id}_${customerId}_${plan}_${priceId}`
      return stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1
          }
        ],
        mode: 'subscription',
        success_url: `${process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_URL || ''}/broker/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_URL || ''}/broker/subscription`,
        metadata: {
          userId: user.id,
          brokerId: user.brokerProfile!.id,
          plan: checkoutPlan.plan.code
        },
        subscription_data: {
          metadata: {
            userId: user.id,
            brokerId: user.brokerProfile!.id,
            plan: checkoutPlan.plan.code,
          },
        },
        billing_address_collection: 'required',
      }, {
        idempotencyKey,
      })
    })

    console.info('Subscription checkout created', { correlationId, brokerId: user.brokerProfile.id, plan: checkoutPlan.plan.code })

    return NextResponse.json({
      success: true,
      url: checkoutSession.url
    })

  } catch (error: unknown) {
    console.error('Error creating checkout session', { correlationId: getCorrelationId(request), error: error instanceof Error ? error.message : 'Unknown error' })
    if (error instanceof CheckoutConflictError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 409 })
    }
    if (error instanceof BillingUnavailableError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 503 })
    }
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
