/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/brokers/route.ts
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import prisma from '@/lib/prisma'
import { TABLE_ROW_PAGE } from '@/utils'
import { VerificationStatus, BrokerStatus } from '@prisma/client'
import { hasPaidEntitlement, isMortgageExpertBroker, publicBrokerWhere } from '@/lib/broker-policy'
import { BROKER_PLAN_FEATURES, brokerSubscriptionHasFeature } from '@/lib/broker-plans'
import { toPublicBrokerRecord } from '@/lib/public-broker'
import { createBrokerForExistingUser } from '@/lib/broker-registration'
import { validateLicenseStates, normalizeNmls, nmlsValidationError } from '@/lib/broker-licensing'
import { findBrokerIdsWithinRadius } from '@/lib/location/broker-geo'
import { resolveUSPlace } from '@/lib/location/google-place'
import { requireValidResolvedUSLocation } from '@/lib/location/broker-location'
import { verifySearchLocationToken } from '@/lib/location/search-token'
import { isSameOriginRequest } from '@/lib/origin'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const pageParam = parseInt(searchParams.get('page') || '1')
    const requestedPage = Number.isInteger(pageParam) && pageParam >= 1 ? pageParam : 1
    const take = TABLE_ROW_PAGE

    const state = searchParams.get('state')
    const zip = searchParams.get('zip')
    const minRating = searchParams.get('minRating')
    const verificationStatus = searchParams.get('verificationStatus')
    const brokerStatus = searchParams.get('brokerStatus')
    const minExperience = searchParams.get('minExperience')
    const search = searchParams.get('search') || searchParams.get('q')
    const latitudeParam = searchParams.get('latitude')
    const longitudeParam = searchParams.get('longitude')
    const radiusParam = searchParams.get('radius')
    const locationState = searchParams.get('locationState')
    const locationZip = searchParams.get('locationZip')
    const locationCity = searchParams.get('locationCity')
    const locationToken = searchParams.get('locationToken')

    const currentUser = await getCurrentUser()
    const isAdmin = currentUser?.role === 'ADMIN'

    const publicEligibility: any = isAdmin ? {} : publicBrokerWhere()

    const buildSearchFilter = (term: string | null | undefined) => term ? {
      OR: [
        { displayName: { contains: term, mode: 'insensitive' } },
        { companyName: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
        { officeAddress: { contains: term, mode: 'insensitive' } },
        { city: { contains: term, mode: 'insensitive' } },
        { state: { contains: term, mode: 'insensitive' } },
        { pinCode: { contains: term, mode: 'insensitive' } },
      ],
    } : {}

    const where: any = {
      ...publicEligibility,
      ...buildSearchFilter(search),
    }

    // Apply non-geographic filters for the normal (non-radius) listing.
    if (state) where.state = { contains: state, mode: 'insensitive' }
    if (zip) where.pinCode = { contains: zip, mode: 'insensitive' }
    if (minRating) where.avgRating = { gte: parseFloat(minRating) }
    if (verificationStatus) where.verificationStatus = verificationStatus as VerificationStatus
    if (brokerStatus) where.brokerStatus = brokerStatus as BrokerStatus
    if (minExperience) where.experienceYears = { gte: parseInt(minExperience) }

    const hasAnyCoordinate = latitudeParam !== null || longitudeParam !== null || radiusParam !== null || locationToken !== null
    let verifiedLocation
    if (hasAnyCoordinate) {
      if (!locationToken) return NextResponse.json({ message: 'A server-validated search location is required' }, { status: 400 })
      try {
        verifiedLocation = verifySearchLocationToken(locationToken)
      } catch {
        return NextResponse.json({ message: 'Invalid or expired search location' }, { status: 400 })
      }
    }
    const latitude = verifiedLocation?.latitude ?? (latitudeParam === null ? null : Number(latitudeParam))
    const longitude = verifiedLocation?.longitude ?? (longitudeParam === null ? null : Number(longitudeParam))
    const radius = radiusParam === null ? 0 : Number(radiusParam)
    if (hasAnyCoordinate && (!verifiedLocation || !Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(radius) || radius < 0 || radius > 100)) {
      return NextResponse.json({ message: 'Valid location coordinates and a radius from 0 to 100 are required' }, { status: 400 })
    }

    // radius === 0 means "exact selected-location search without radius
    // expansion". A verified city selection constrains city + state; a ZIP
    // selection constrains pinCode + state. Never reduce a city selection to
    // state-only, and never filter by a service-area array.
    if (radius === 0) {
      const resolvedCity = locationCity || verifiedLocation?.city
      const resolvedState = locationState || verifiedLocation?.state
      const resolvedZip = locationZip || verifiedLocation?.zip
      if (resolvedCity) where.city = { contains: resolvedCity, mode: 'insensitive' }
      if (!state && resolvedState) where.state = { contains: resolvedState, mode: 'insensitive' }
      if (!zip && resolvedZip) where.pinCode = { contains: resolvedZip, mode: 'insensitive' }
    }

    const geoWhere: any = {
      ...publicEligibility,
      ...buildSearchFilter(search),
    }

    let page = requestedPage
    let geoResult: any = null

    if (radius > 0) {
      geoResult = await findBrokerIdsWithinRadius({
        latitude: latitude!,
        longitude: longitude!,
        radiusMiles: radius,
        page,
        take,
        search,
        admin: isAdmin,
      })
    }

    // Resolve the total page count against the SAME visibility/search/filter
    // conditions as the broker query, then clamp the requested page to a valid
    // range so an out-of-range page never renders an empty result set.
    const total = geoResult
      ? geoResult.total
      : await prisma.broker.count({ where })
    const totalPages = total > 0 ? Math.ceil(total / take) : 1
    if (page > totalPages) page = totalPages

    // Re-run the geo facet if the page was clamped so the returned IDs match
    // the corrected page.
    if (radius > 0 && page !== requestedPage) {
      geoResult = await findBrokerIdsWithinRadius({
        latitude: latitude!,
        longitude: longitude!,
        radiusMiles: radius,
        page,
        take,
        search,
        admin: isAdmin,
      })
    }

    const [brokers] = await Promise.all([
      prisma.broker.findMany({
        skip: geoResult ? 0 : take * (page - 1),
        take: geoResult ? Math.max(geoResult.ids.length, 1) : take,
        where: geoResult ? { ...geoWhere, id: { in: geoResult.ids } } : where,
        include: {
          user: {
            select: {
              name: true,
              image: true,
              isActive: true,
            }
          },
          reviews: {
            where: { status: 'APPROVED' },
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  image: true
                }
              }
            }
          },
          bankPartners: {
            select: {
              id: true,
              bankName: true,
              bankType: true
            }
          },
          subscription: {
            select: {
              plan: true,
              planId: true,
              isActive: true,
              endDate: true,
              planRef: { include: { features: true } },
            }
          }
        },
        orderBy: [
          { featuredRank: 'desc' },           // Tier 1: active FEATURED subscribers
          { mortgageExpertEnabled: 'desc' },  // Tier 2: admin-enabled Mortgage Expert brokers
          { profileImage: 'desc' },           // Tier 3: brokers with an uploaded profile photo
          { experienceYears: 'desc' },
          { id: 'asc' },
        ]
      }),
    ])

    const orderedBrokers = geoResult
      ? [...brokers].sort((a, b) => geoResult.ids.indexOf(a.id) - geoResult.ids.indexOf(b.id))
      : brokers
    const publicBrokers = orderedBrokers.map((broker) => {
      const canShowContact = hasPaidEntitlement(broker.subscription)
      return {
        ...toPublicBrokerRecord(broker, { includeContact: canShowContact }),
        isFeatured: canShowContact && broker.subscription?.plan === 'FEATURED',
        isMortgageExpert: isMortgageExpertBroker({
          mortgageExpertEnabled: broker.mortgageExpertEnabled,
          profileBadge: brokerSubscriptionHasFeature(broker.subscription, BROKER_PLAN_FEATURES.PROFILE_BADGE),
        }),
        canShowContact,
      }
    })

    const mode = radius > 0
      ? 'RADIUS'
      : (locationCity || verifiedLocation?.city) ? 'CITY'
      : (locationZip || verifiedLocation?.zip) ? 'ZIP'
      : search ? 'TEXT'
      : 'ALL'

    console.log('[BROKER API]', {
      role: currentUser?.role ?? 'ANONYMOUS',
      mode,
      dbCount: brokers.length,
      total,
      publicCount: publicBrokers.length,
      hasRadius: radius > 0,
      radius,
      locationCity: locationCity || verifiedLocation?.city || null,
      locationState: locationState || verifiedLocation?.state || null,
      hasLocationToken: Boolean(locationToken),
    })
    return NextResponse.json({
      brokers: publicBrokers,
      total,
      totalPages,
      currentPage: page
    })
  } catch (error: any) {
    console.error('GET /api/brokers error:', error)
    const message = error?.message?.includes('Radius search is unavailable')
      ? error.message
      : 'Failed to fetch brokers'
    return NextResponse.json(
      { message, error: error?.message || 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ message: 'Invalid request origin' }, { status: 403 })
    }

    const currentUser = await getCurrentUser()

    if (!currentUser) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 }
      )
    }

    if (currentUser.role !== 'BROKER' || !currentUser.brokerRegistration) {
      return NextResponse.json(
        { message: 'Broker registration intent is required' },
        { status: 403 }
      )
    }
    if (currentUser.brokerRegistration.subscription?.status !== 'ACTIVE' || !currentUser.brokerRegistration.subscription.isActive) {
      return NextResponse.json(
        { message: 'An active broker subscription is required before onboarding' },
        { status: 409 }
      )
    }

    // Check if user is already a broker
    const existingBroker = await prisma.broker.findFirst({
      where: { userId: currentUser.id }
    })

    if (existingBroker) {
      return NextResponse.json(
        {
          message: 'You already have a broker profile',
          brokerId: existingBroker.id
        },
        { status: 400 }
      )
    }

    const body = await request.json()

    // The office location is authoritative: the server re-resolves the Google
    // place ID selected on the client and derives the canonical structured
    // fields (officeAddress, city, state, pinCode, coordinates, place ID)
    // from the verified result. Arbitrary client-supplied address text is
    // never trusted, so a mismatched combination cannot be persisted.
    const placeId = body.location && typeof body.location === 'object' && typeof (body.location as { placeId?: unknown }).placeId === 'string'
      ? (body.location as { placeId: string }).placeId.trim()
      : ''
    if (!placeId) {
      return NextResponse.json({ message: 'A validated US office location is required' }, { status: 400 })
    }
    let resolvedLocation
    try {
      resolvedLocation = await resolveUSPlace(placeId)
      requireValidResolvedUSLocation(resolvedLocation)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Office location could not be validated'
      return NextResponse.json({ message }, { status: 400 })
    }

    // Validate required broker profile fields.
    const requiredFields: Array<keyof typeof body & string> = [
      'displayName',
      'phone',
      'description',
    ]

    const missingFields = requiredFields.filter(field => !body[field])

    // NMLS + licensed states are required to complete US broker onboarding.
    const nmls = normalizeNmls(body.nmls)
    const nmlsError = nmlsValidationError(nmls)
    if (nmlsError) {
      return NextResponse.json(
        { message: nmlsError },
        { status: 422 },
      )
    }
    const licenseStatesResult = validateLicenseStates(body.licenseStates)
    if (!licenseStatesResult.ok) {
      return NextResponse.json({ message: licenseStatesResult.error }, { status: 422 })
    }

    if (missingFields.length > 0) {
      return NextResponse.json(
        { message: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      )
    }

    const broker = await createBrokerForExistingUser(currentUser.id, {
      displayName: body.displayName,
      companyName: body.companyName || null,
      description: body.description,
      profileSlug: body.profileSlug,
      phone: body.phone,
      email: body.email || null,
      logo: typeof body.logo === 'string' ? body.logo : '',
      profileImage: typeof body.profileImage === 'string' ? body.profileImage : '',
      coverImage: typeof body.coverImage === 'string' ? body.coverImage : '',
      experienceYears: Number(body.experienceYears) || 0,
      bankPartnerships: Array.isArray(body.bankPartnerships) ? body.bankPartnerships : [],
      nmls,
      licenseStates: licenseStatesResult.states,
      location: resolvedLocation,
    })

    return NextResponse.json({
      message: 'Broker profile created successfully',
      broker,
      profileUrl: `/broker/${broker.profileSlug}`,
      nextSteps: [
        'Complete your profile verification',
        'Add your bank partnerships',
        'Set up your subscription plan',
        'Start receiving leads from customers'
      ]
    })
  } catch (error: any) {
    if (error?.name === 'AlreadyBrokerError') {
      return NextResponse.json(
        { message: 'You already have a broker profile' },
        { status: 400 }
      )
    }
    if (error?.name === 'BrokerSubscriptionRequiredError') {
      return NextResponse.json(
        { message: error.message },
        { status: 409 }
      )
    }
    console.error('POST /api/brokers error:', error)
    return NextResponse.json(
      { message: 'Failed to create broker profile', error: error.message },
      { status: 500 }
    )
  }
}
