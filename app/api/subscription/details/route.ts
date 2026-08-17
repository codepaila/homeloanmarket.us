import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import prisma from '@/lib/prisma'
import Stripe from 'stripe'
import type { SubscriptionWithPeriod } from '@/types/stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    let subscriptionData = {
      plan: user.subscriptionPlan,
      planName: user.subscriptionPlan,
      status: user.subscriptionStatus,
      startDate: user.subscriptionStartDate,
      endDate: user.subscriptionEndDate,
      nextBillingDate: null as Date | null,
      trialEndDate: null as Date | null,
      hasPaymentFailure: false,
      lastPaymentFailedAt: null as Date | null,
      isActive: user.hasActiveSubscription,
    }

    // If user has Stripe subscription, fetch additional details
    if (user.subscriptionId) {
      try {
        const stripeSubscription = await stripe.subscriptions.retrieve(user.subscriptionId) as unknown as SubscriptionWithPeriod
        
        subscriptionData = {
          ...subscriptionData,
          status: stripeSubscription.status.toUpperCase(),
          startDate: new Date(stripeSubscription.current_period_start * 1000),
          endDate: new Date(stripeSubscription.current_period_end * 1000),
          nextBillingDate: new Date(stripeSubscription.current_period_end * 1000),
          trialEndDate: stripeSubscription.trial_end 
            ? new Date(stripeSubscription.trial_end * 1000) 
            : null,
        }
      } catch (error) {
        console.error('Error fetching Stripe subscription:', error)
      }
    }

    return NextResponse.json({
      success: true,
      data: subscriptionData
    })

  } catch (error) {
    console.error('Error fetching subscription details:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch subscription details' },
      { status: 500 }
    )
  }
}
