// app/brokers/[id]/page.tsx - Server Component
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import prisma from '@/lib/prisma'
import BrokerDetailClient from '@/components/sections/broker/BrokerDetailClient'
import { isPublicBroker, isMortgageExpertBroker } from '@/lib/broker-policy'
import { BROKER_PLAN_FEATURES, brokerSubscriptionHasFeature } from '@/lib/broker-plans'
import { canonicalUrl, safeJsonLd, brokerLocalBusinessJsonLd, breadcrumbJsonLd } from '@/lib/seo'
import { locationHasValidCoordinates } from '@/lib/location/broker-location'
import { toPublicBrokerRecord } from '@/lib/public-broker'

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
      user: { select: { isActive: true } },
    },
  })

  if (!broker || !isPublicBroker({
    isVisible: broker.isVisible,
    verificationStatus: broker.verificationStatus,
    brokerStatus: broker.brokerStatus,
    userId: broker.userId,
    userIsActive: broker.user?.isActive,
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
  })) {
    notFound()
  }

  const publicBroker = {
    ...toPublicBrokerRecord(broker, { includeContact: true }),
    hasOwner: Boolean(broker.userId),
    isMortgageExpert: isMortgageExpertBroker({
      mortgageExpertEnabled: broker.mortgageExpertEnabled,
      profileBadge: brokerSubscriptionHasFeature(broker.subscription, BROKER_PLAN_FEATURES.PROFILE_BADGE),
    }),
  }

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
      <BrokerDetailClient brokerSlug={brokerSlug} initialBroker={publicBroker} />
    </>
  )
}
