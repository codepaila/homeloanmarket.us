import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getCurrentUser } from '@/lib/currentUser'
import prisma from '@/lib/prisma'
import { SubscriptionService } from '@/lib/subscription'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const sessionId = request.nextUrl.searchParams.get('session_id')
    if (!sessionId || !sessionId.startsWith('cs_')) {
      return NextResponse.json({ success: false, error: 'Invalid checkout session' }, { status: 400 })
    }

    if (!user.brokerProfile) {
      return NextResponse.json({ success: false, error: 'Broker profile not found' }, { status: 404 })
    }

    const storedSubscription = await prisma.brokerSubscription.findUnique({
      where: { brokerId: user.brokerProfile.id },
      select: { stripeCustomerId: true },
    })
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id

    if (!customerId || !storedSubscription?.stripeCustomerId || customerId !== storedSubscription.stripeCustomerId) {
      return NextResponse.json({ success: false, error: 'Checkout session does not belong to this account' }, { status: 403 })
    }

    if (session.metadata?.userId && session.metadata.userId !== user.id) {
      return NextResponse.json({ success: false, error: 'Checkout session does not belong to this account' }, { status: 403 })
    }
    if (session.metadata?.brokerId && session.metadata.brokerId !== user.brokerProfile.id) {
      return NextResponse.json({ success: false, error: 'Checkout session does not belong to this account' }, { status: 403 })
    }
    if (
      session.status !== 'complete' ||
      session.payment_status !== 'paid' ||
      typeof session.subscription !== 'string'
    ) {
      return NextResponse.json({ success: false, error: 'Checkout session is not complete' }, { status: 409 })
    }

    const stripeSubscription = await stripe.subscriptions.retrieve(session.subscription)
    if (!['active', 'trialing'].includes(stripeSubscription.status)) {
      return NextResponse.json({ success: false, error: 'Subscription is not active' }, { status: 409 })
    }
    const priceId = stripeSubscription.items.data[0]?.price.id
    const updated = await SubscriptionService.updateSubscriptionFromStripe(
      customerId,
      stripeSubscription.id,
      stripeSubscription.status,
      priceId,
    )

    return NextResponse.json({
      success: true,
      data: {
        planName: updated.plan,
        plan: updated.plan,
        isActive: updated.isActive,
      },
    })
  } catch (error) {
    console.error('Subscription verification failed:', error)
    return NextResponse.json({ success: false, error: 'Unable to verify checkout session' }, { status: 500 })
  }
}
