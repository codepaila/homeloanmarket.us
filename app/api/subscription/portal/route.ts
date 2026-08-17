import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import Stripe from 'stripe'
import { SubscriptionService } from '@/lib/subscription'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!user.stripeCustomerId) {
      return NextResponse.json(
        { success: false, error: 'No Stripe customer found' },
        { status: 400 }
      )
    }

    if (!user.brokerProfile) return NextResponse.json({ success: false, error: 'Broker profile not found' }, { status: 404 })
    await SubscriptionService.assertStripeCustomerOwnership(user.id, user.brokerProfile.id, user.stripeCustomerId)

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_URL || ''}/broker/subscription`,
    })

    return NextResponse.json({
      success: true,
      url: portalSession.url
    })

  } catch (error) {
    console.error('Error creating portal session:', error)
    const message = error instanceof Error ? error.message : 'Failed to create portal session'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
