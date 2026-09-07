// app/api/brokers/featured/route.ts
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { isMortgageExpertBroker } from '@/lib/broker-policy'
import { brokerSubscriptionHasProfileBadge } from '@/lib/broker-plans'

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
        brokerStatus: { not: 'SUSPENDED' },
        // Profile completeness (mirrors publicBrokerWhere): paid featured
        // brokers must still be complete to appear on the public homepage.
        displayName: { not: '' },
        description: { not: '' },
        phone: { not: '' },
        officeAddress: { not: '' },
        profileSlug: { not: '' },
        // Canonical ownership eligibility (mirrors publicBrokerWhere): an
        // unowned broker is eligible, and an owned broker must belong to an
        // active, non-company user. An advertising/company account is never a
        // public broker owner.
        OR: [
          { userId: null },
          { user: { isActive: true, companyMemberships: { none: { isActive: true } } } },
        ],
        subscription: {
          is: {
            isActive: true,
            plan: 'FEATURED',
            // An ACTIVE FEATURED subscription stores endDate=null (cleared when
            // it becomes active); a null endDate must count as active, mirroring
            // the listing's tier-1 rule. Requiring endDate > now alone would
            // hide every active FEATURED subscriber from the home section.
            OR: [{ endDate: null }, { endDate: { gt: new Date() } }],
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
          profileBadge: brokerSubscriptionHasProfileBadge(broker.subscription),
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
