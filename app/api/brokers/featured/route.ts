// app/api/brokers/featured/route.ts
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { isMortgageExpertBroker } from '@/lib/broker-policy'
import { BROKER_PLAN_FEATURES, brokerSubscriptionHasFeature } from '@/lib/broker-plans'

// The featured row card renders identity, ratings, description, bank partner
// names, and the two server-computed badges. Contact details, reviews, and the
// full user/subscription objects are not needed for the public section.
const FEATURED_SELECT = {
  id: true,
  profileSlug: true,
  displayName: true,
  companyName: true,
  logo: true,
  profileImage: true,
  description: true,
  city: true,
  state: true,
  verificationStatus: true,
  brokerStatus: true,
  avgRating: true,
  totalReviews: true,
  experienceYears: true,
  mortgageExpertEnabled: true,
  bankPartners: { select: { bankName: true } },
  subscription: {
    select: {
      plan: true,
      isActive: true,
      endDate: true,
      planRef: { include: { features: true } },
    },
  },
} as const

export async function GET() {
  try {
    const brokers = await prisma.broker.findMany({
      where: {
        isVisible: true,
        verificationStatus: 'VERIFIED',
        brokerStatus: { not: 'SUSPENDED' },
        user: { isActive: true },
        subscription: {
          is: {
            isActive: true,
            plan: 'FEATURED',
            endDate: { gt: new Date() },
          },
        },
      },
      select: FEATURED_SELECT,
      orderBy: [
        { featuredRank: 'desc' },
        { avgRating: 'desc' },
        { totalReviews: 'desc' },
      ],
      take: 8,
    })

    // The home section only surfaces the top few, so a small take plus a
    // compact record keeps the payload minimal. Every returned broker is a
    // paid FEATURED subscriber (filtered above); the badge is emitted
    // server-side instead of shipping the subscription object.
    return NextResponse.json({
      brokers: brokers.map((broker) => ({
        id: broker.id,
        profileSlug: broker.profileSlug,
        displayName: broker.displayName,
        companyName: broker.companyName,
        logo: broker.logo,
        profileImage: broker.profileImage,
        description: broker.description,
        city: broker.city,
        state: broker.state,
        verificationStatus: broker.verificationStatus,
        brokerStatus: broker.brokerStatus,
        avgRating: broker.avgRating,
        totalReviews: broker.totalReviews,
        experienceYears: broker.experienceYears,
        bankPartners: (broker.bankPartners ?? []).map((bank) => ({ bankName: bank.bankName })),
        isFeatured: true,
        isMortgageExpert: isMortgageExpertBroker({
          mortgageExpertEnabled: broker.mortgageExpertEnabled,
          profileBadge: brokerSubscriptionHasFeature(broker.subscription, BROKER_PLAN_FEATURES.PROFILE_BADGE),
        }),
      })),
    })
  } catch (error) {
    console.error('GET /api/brokers/featured error:', error)
    const message =
      error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { message: 'Failed to fetch featured brokers', error: message },
      { status: 500 }
    )
  }
}
