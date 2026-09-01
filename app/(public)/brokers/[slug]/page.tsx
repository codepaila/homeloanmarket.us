// app/brokers/[id]/page.tsx - Server Component
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import prisma from '@/lib/prisma'
import BrokerDetailClient from '@/components/sections/broker/BrokerDetailClient'
import { isPublicBroker, isMortgageExpertBroker, hasPaidEntitlement } from '@/lib/broker-policy'
import { BROKER_PLAN_FEATURES, brokerSubscriptionHasFeature } from '@/lib/broker-plans'
import { canonicalUrl, safeJsonLd, brokerLocalBusinessJsonLd, breadcrumbJsonLd } from '@/lib/seo'
import { locationHasValidCoordinates } from '@/lib/location/broker-location'
import { toPublicBrokerRecord, toPublicBrokerListRecord } from '@/lib/public-broker'
import { getPublicListingPage } from '@/lib/broker-listing'

// Compact column set for the "Similar mortgage originators" cards on the
// profile page — the same fields the public listing grid renders (identity +
// rating + the two server-computed badges). Rendered server-side so the section
// is present in the initial HTML (no client fetch, no mount-time layout shift).
const RELATED_SELECT = {
  id: true,
  profileSlug: true,
  displayName: true,
  companyName: true,
  city: true,
  state: true,
  nmls: true,
  logo: true,
  profileImage: true,
  avgRating: true,
  totalReviews: true,
  experienceYears: true,
  mortgageExpertEnabled: true,
  subscription: {
    select: {
      plan: true,
      isActive: true,
      endDate: true,
      planRef: {
        select: {
          features: { select: { code: true, enabled: true } },
        },
      },
    },
  },
} as const

interface PageProps {
  params: Promise<{
    slug: string
  }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const slug = (await params).slug
  const broker = await prisma.broker.findUnique({
    where: { profileSlug: slug },
    select: {
      displayName: true,
      companyName: true,
      description: true,
      city: true,
      state: true,
      logo: true,
      coverImage: true,
      isVisible: true,
      verificationStatus: true,
      brokerStatus: true,
      userId: true,
      user: { select: { isActive: true, companyMemberships: { where: { isActive: true }, select: { id: true } } } },
    },
  })

  if (!broker || !isPublicBroker({
    isVisible: broker.isVisible,
    verificationStatus: broker.verificationStatus,
    brokerStatus: broker.brokerStatus,
    userId: broker.userId,
    userIsActive: broker.user?.isActive,
    hasActiveCompanyMembership: (broker.user?.companyMemberships?.length ?? 0) > 0,
  })) {
    return { title: 'Mortgage Originator Profile Not Found', robots: { index: false, follow: false } }
  }

  const name = broker.companyName || broker.displayName
  const location = [broker.city, broker.state].filter(Boolean).join(', ')
  const description = `${name}${location ? ` in ${location}` : ''} - view profile information and reviews on HomeLoanMarket.`
  return {
    title: `${name}${location ? ` in ${location}` : ''}`,
    description: broker.description || description,
    alternates: { canonical: canonicalUrl(`/brokers/${slug}`) },
      openGraph: {
      type: 'profile',
      title: name,
      description: broker.description || description,
        url: canonicalUrl(`/brokers/${slug}`),
        ...(broker.coverImage || broker.logo ? { images: [{ url: broker.coverImage || broker.logo || '', alt: name }] } : {}),
      },
    robots: { index: true, follow: true },
  }
}

export default async function PublicBrokerPage({ params }: PageProps) {
  const brokerSlug = (await params).slug

  let broker
  try {
    broker = await prisma.broker.findUnique({
      where: { profileSlug: brokerSlug },
      include: {
        user: {
          select: {
            name: true,
            image: true,
            isActive: true,
            companyMemberships: { where: { isActive: true }, select: { id: true } },
          }
        },
        bankPartners: {
          select: { bankName: true, bankType: true, since: true },
          orderBy: { bankName: 'asc' },
        },
        reviews: {
          where: { status: 'APPROVED' },
          select: { rating: true, comment: true, createdAt: true, user: { select: { name: true, image: true } } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: { select: { reviews: { where: { status: 'APPROVED' } } } },
        subscription: {
          select: { plan: true, planId: true, isActive: true, endDate: true, planRef: { include: { features: true } } },
        },
      }
    })

  } catch (error) {
    console.error('Error fetching broker:', error)
    notFound()
  }

  if (!broker) notFound()

  if (!isPublicBroker({
    isVisible: broker.isVisible,
    verificationStatus: broker.verificationStatus,
    brokerStatus: broker.brokerStatus,
    userId: broker.userId,
    userIsActive: broker.user?.isActive,
    hasActiveCompanyMembership: (broker.user?.companyMemberships?.length ?? 0) > 0,
  })) {
    notFound()
  }

  const publicBroker = {
    ...toPublicBrokerRecord(broker, { includeContact: true }),
    hasOwner: Boolean(broker.userId),
    isFeatured: hasPaidEntitlement(broker.subscription),
    isMortgageExpert: isMortgageExpertBroker({
      mortgageExpertEnabled: broker.mortgageExpertEnabled,
      profileBadge: brokerSubscriptionHasFeature(broker.subscription, BROKER_PLAN_FEATURES.PROFILE_BADGE),
    }),
  }

  // Similar brokers: the top-priority public brokers, excluding this one,
  // resolved server-side through the same listing ordering used by /brokers.
  // Passed as initialRelated so the section is server-rendered and never
  // triggers a client fetch or a mount-time layout shift.
  const relatedPage = await getPublicListingPage({}, { page: 1, take: 4, admin: false })
  const relatedIds = relatedPage.ids.filter((id) => id !== broker.id)
  const relatedBrokers = relatedIds.length
    ? await prisma.broker.findMany({
        where: { id: { in: relatedIds } },
        select: RELATED_SELECT,
      })
    : []
  const initialRelated = relatedBrokers.map((related) =>
    toPublicBrokerListRecord(related, {
      isFeatured: hasPaidEntitlement(related.subscription),
      isMortgageExpert: isMortgageExpertBroker({
        mortgageExpertEnabled: related.mortgageExpertEnabled,
        profileBadge: brokerSubscriptionHasFeature(related.subscription, BROKER_PLAN_FEATURES.PROFILE_BADGE),
      }),
    }),
  )

  const brokerName = broker.companyName || broker.displayName
  const locationValue = broker.location as { type?: string; coordinates?: unknown } | null | undefined
  const hasCoords = locationValue ? locationHasValidCoordinates(locationValue) : false
  const coords = (Array.isArray(locationValue?.coordinates) && locationValue.coordinates.length === 2)
    ? { longitude: Number(locationValue.coordinates[0]), latitude: Number(locationValue.coordinates[1]) }
    : null

  const brokerLd = brokerLocalBusinessJsonLd({
    name: brokerName,
    description: broker.description,
    url: canonicalUrl(`/brokers/${broker.profileSlug}`),
    image: broker.profileImage || broker.logo,
    city: broker.city,
    state: broker.state,
    postalCode: broker.pinCode,
    countryCode: 'US',
    ...(hasCoords && coords ? { latitude: coords.latitude, longitude: coords.longitude } : {}),
    telephone: broker.phone,
    email: broker.email,
    nmls: broker.nmls,
    totalReviews: broker.totalReviews,
    avgRating: broker.avgRating,
  })

  const breadcrumbLd = breadcrumbJsonLd([
    { name: 'Home', path: '/' },
    { name: 'Find Mortgage Originators', path: '/brokers' },
    { name: brokerName, path: `/brokers/${broker.profileSlug}` },
  ])

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(brokerLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbLd) }}
      />
      <BrokerDetailClient brokerSlug={brokerSlug} initialBroker={publicBroker} initialRelated={initialRelated} />
    </>
  )
}
