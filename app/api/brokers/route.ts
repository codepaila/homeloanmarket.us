/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/brokers/route.ts
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import prisma from '@/lib/prisma'
import { TABLE_ROW_PAGE } from '@/utils'
import { VerificationStatus, BrokerStatus } from '@prisma/client'
import { hasPaidEntitlement } from '@/lib/broker-policy'
import { toPublicBrokerRecord } from '@/lib/public-broker'
import { createBrokerForExistingUser } from '@/lib/broker-registration'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const take = TABLE_ROW_PAGE
    const skip = TABLE_ROW_PAGE * (page - 1)
    
    const city = searchParams.get('city')
    const zip = searchParams.get('zip')
    const specialization = searchParams.get('specialization')
    const minRating = searchParams.get('minRating')
    const verificationStatus = searchParams.get('verificationStatus')
    const brokerStatus = searchParams.get('brokerStatus')
    const minExperience = searchParams.get('minExperience')
    const language = searchParams.get('language')
    const search = searchParams.get('search') || searchParams.get('q')

    const where: any = {}

    // Apply filters based on your Prisma schema
    if (city) where.serviceCities = { has: city }
    if (zip) where.pinCode = { contains: zip, mode: 'insensitive' }
    if (specialization) where.specializations = { has: specialization }
    if (minRating) where.avgRating = { gte: parseFloat(minRating) }
    if (verificationStatus) where.verificationStatus = verificationStatus as VerificationStatus
    if (brokerStatus) where.brokerStatus = brokerStatus as BrokerStatus
    if (minExperience) where.experienceYears = { gte: parseInt(minExperience) }
    if (language) where.languages = { has: language }
    
    if (search) {
      where.OR = [
        { displayName: { contains: search, mode: 'insensitive' } },
        { companyName: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { officeAddress: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { state: { contains: search, mode: 'insensitive' } },
        { pinCode: { contains: search, mode: 'insensitive' } },
      ]
    }

    // For non-admin users, only show visible, verified brokers
    const currentUser = await getCurrentUser()
    if (!currentUser?.role || currentUser.role !== 'ADMIN') {
      where.isVisible = true
      where.verificationStatus = 'VERIFIED'
      where.AND = [
        ...(where.AND || []),
        { brokerStatus: { not: 'SUSPENDED' } },
        {
          OR: [
            { userId: null },
            { user: { isActive: true } },
          ]
        },
      ]
    }

    const [brokers, total] = await Promise.all([
      prisma.broker.findMany({
        skip,
        take,
        where,
        include: {
          user: {
            select: {
              name: true,
              image: true,
              isActive: true,
            }
          },
          reviews: {
            where: { isPublished: true },
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
              isActive: true,
              endDate: true
            }
          }
        },
        orderBy: [
          { brokerStatus: 'desc' }, // FEATURED first
          { featuredRank: 'desc' },
          { avgRating: 'desc' },
          { experienceYears: 'desc' }
        ]
      }),
      prisma.broker.count({ where })
    ])

    const publicBrokers = brokers.map((broker) => {
      const canShowContact = hasPaidEntitlement(broker.subscription)
      return {
        ...toPublicBrokerRecord(broker, { includeContact: canShowContact }),
        isFeatured: canShowContact && broker.subscription?.plan === 'FEATURED',
        canShowContact,
      }
    })

    return NextResponse.json({
      brokers: publicBrokers,
      total,
      totalPages: Math.ceil(total / take),
      currentPage: page
    })
  } catch (error: any) {
    console.error('GET /api/brokers error:', error)
    return NextResponse.json(
      { message: 'Failed to fetch brokers', error: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check if user is already a broker
    const existingBroker = await prisma.broker.findUnique({
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

    // The onboarding wizard submits the postal code as `zipCode`; the canonical
    // schema field is `pinCode`. Accept either input and map to `pinCode`.
    const pinCode = typeof body.pinCode === 'string' && body.pinCode.trim()
      ? body.pinCode.trim()
      : typeof body.zipCode === 'string' ? body.zipCode.trim() : ''

    // Validate required fields based on your schema
    const requiredFields: Array<keyof typeof body & string> = [
      'displayName',
      'phone',
      'officeAddress',
      'city',
      'state',
      'description'
    ]

    const missingFields = requiredFields.filter(field => !body[field])
    if (!pinCode) missingFields.push('pinCode' as never)

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
      officeAddress: body.officeAddress,
      city: body.city,
      state: body.state,
      pinCode,
      experienceYears: Number(body.experienceYears) || 0,
      specializations: body.specializations || ['Home Loan'],
      serviceCities: body.serviceCities || [],
      languages: body.languages || ['English', 'Hindi'],
      bankPartnerships: Array.isArray(body.bankPartnerships) ? body.bankPartnerships : [],
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
    if (error?.name === 'ServiceCityLimitError') {
      return NextResponse.json(
        { message: error.message, error: 'SUBSCRIPTION_LIMIT' },
        { status: 403 }
      )
    }
    console.error('POST /api/brokers error:', error)
    return NextResponse.json(
      { message: 'Failed to create broker profile', error: error.message },
      { status: 500 }
    )
  }
}
