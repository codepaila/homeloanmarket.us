import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import prisma from '@/lib/prisma'
import { SubscriptionService } from '@/lib/subscription'
import { listBrokerPlansPublic } from '@/lib/broker-plans'

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
        subscription: { include: { planRef: true } },
        bankPartners: true,
        contactMessages: {
          where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }
        },
        reviews: true,
      }
    })

    if (!broker) {
      return NextResponse.json({ success: false, error: 'Broker not found' }, { status: 404 })
    }

    const subscription = SubscriptionService.effectiveSubscription(broker.subscription)
    const plan = subscription.plan

    // Resolve the current plan's display info from the database (single source
    // of truth). The static catalog is not consulted.
    const publicPlans = await listBrokerPlansPublic()
    const currentPlanInfo = publicPlans.find((p) => p.code === plan) || null

    const usage = {
      teamMembers: 1,
      branches: 1,
      loanProducts: broker.bankPartners.length,
      contactMessages: broker.contactMessages.length,
      profileViews: broker.profileViews,
      totalLeads: broker.totalLeads,
      bankPartners: broker.bankPartners.length,
      reviews: broker.totalReviews,
    }

    return NextResponse.json({
      success: true,
      data: {
        usage,
        subscription: {
          plan,
          isActive: subscription.isActive,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
        },
        planInfo: currentPlanInfo,
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