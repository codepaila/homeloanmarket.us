import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getCurrentUser } from '@/lib/currentUser'
import { SubscriptionService } from '@/lib/subscription'
import prisma from '@/lib/prisma'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'BROKER') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!user.brokerRegistration) return NextResponse.json({ error: 'Broker registration not found' }, { status: 404 })

    const sessionId = request.nextUrl.searchParams.get('session_id')
    if (!sessionId || !sessionId.startsWith('cs_')) return NextResponse.json({ error: 'Invalid checkout session' }, { status: 400 })

    const local = await prisma.brokerRegistrationSubscription.findUnique({
      where: { registrationId: user.brokerRegistration.id },
      select: { stripeCustomerId: true },
    })
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
    if (!customerId || customerId !== local?.stripeCustomerId) return NextResponse.json({ error: 'Checkout session does not belong to this account' }, { status: 403 })
    if (session.metadata?.userId && session.metadata.userId !== user.id) return NextResponse.json({ error: 'Checkout session does not belong to this account' }, { status: 403 })
    if (session.metadata?.brokerRegistrationId && session.metadata.brokerRegistrationId !== user.brokerRegistration.id) return NextResponse.json({ error: 'Checkout session does not belong to this registration' }, { status: 403 })
    if (session.status !== 'complete' || session.payment_status !== 'paid' || typeof session.subscription !== 'string') {
      return NextResponse.json({ error: 'Checkout session is not complete' }, { status: 409 })
    }

    const stripeSubscription = await stripe.subscriptions.retrieve(session.subscription)
    if (!['active', 'trialing'].includes(stripeSubscription.status)) return NextResponse.json({ error: 'Subscription is not active' }, { status: 409 })

    const updated = await SubscriptionService.updateRegistrationSubscriptionFromStripe(
      customerId,
      stripeSubscription.id,
      stripeSubscription.status,
      stripeSubscription.items.data[0]?.price.id,
    )
    if (!updated) return NextResponse.json({ error: 'Registration subscription not found' }, { status: 404 })

    return NextResponse.json({ success: true, plan: updated.plan, redirectTo: '/setup' })
  } catch (error) {
    console.error('Broker registration subscription verification failed:', error)
    return NextResponse.json({ error: 'Unable to verify checkout session' }, { status: 500 })
  }
}
