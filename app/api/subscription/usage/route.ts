import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import { subscriptionPlans } from '@/lib/stripe'
import prisma from '@/lib/prisma'
import { SubscriptionService } from '@/lib/subscription'

export async function GET() {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (!user.brokerProfile) {
      return NextResponse.json({ success: false, error: 'Broker profile not found' }, { status: 404 })
    }

    const broker = await prisma.broker.findUnique({
      where: { id: user.brokerProfile.id },
      include: {
        subscription: true,
        bankPartners: true,
       
        contactMessages: {
          where: {
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            }
          }
        },
        reviews: true
      }
    })

    if (!broker) {
      return NextResponse.json({ success: false, error: 'Broker not found' }, { status: 404 })
    }

    const subscription = SubscriptionService.effectiveSubscription(broker.subscription)
    const plan = subscription.plan
    const planConfig = subscriptionPlans.find(p => p.name === plan) || subscriptionPlans[0]

    // Calculate usage stats
    const usage = {
   
      teamMembers: 1, // Base count, can be expanded
      branches: 1, // Base count, can be expanded
      loanProducts: broker.bankPartners.length,
      contactMessages: broker.contactMessages.length,
      profileViews: broker.profileViews,
      totalLeads: broker.totalLeads,
      bankPartners: broker.bankPartners.length,
      reviews: broker.totalReviews
    }

    return NextResponse.json({
      success: true,
      data: {
        usage,
        subscription: {
          plan: plan,
          isActive: subscription.isActive,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
        },
        limits: planConfig.limits,
        planConfig
      }
    })

  } catch (error) {
    console.error('Error fetching subscription usage:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch subscription usage' },
      { status: 500 }
    )
  }
}
