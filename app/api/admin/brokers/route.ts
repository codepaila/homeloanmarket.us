/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import prisma from '@/lib/prisma'
import {
  normalizeAdminBrokerInput,
  adminCreatedBrokerDefaults,
  slugifyAdminBroker,
  validateAdminBrokerInput,
} from '@/lib/admin-broker'

async function requireAdmin() {
  const user = await getCurrentUser()
  return user?.role === 'ADMIN' ? user : null
}

export async function GET(request: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')?.trim()
  const ownership = searchParams.get('ownership')
  const where: any = {}
  if (search) {
    where.OR = [
      { displayName: { contains: search, mode: 'insensitive' } },
      { companyName: { contains: search, mode: 'insensitive' } },
      { profileSlug: { contains: search, mode: 'insensitive' } },
    ]
  }
  if (ownership === 'UNOWNED') where.userId = null
  if (ownership === 'OWNED') where.userId = { not: null }

  const brokers = await prisma.broker.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      subscription: { select: { plan: true, isActive: true, endDate: true } },
      claim: {
        select: {
          status: true,
          invitations: {
            select: { id: true, recipientEmail: true, status: true, expiresAt: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
  })

  return NextResponse.json({ brokers })
}

export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  try {
    const body = await request.json()
    const input = normalizeAdminBrokerInput({
      displayName: typeof body.displayName === 'string' ? body.displayName : '',
      companyName: typeof body.companyName === 'string' ? body.companyName : undefined,
      description: typeof body.description === 'string' ? body.description : '',
      phone: typeof body.phone === 'string' ? body.phone : '',
      email: typeof body.email === 'string' ? body.email : undefined,
      website: typeof body.website === 'string' ? body.website : undefined,
      officeAddress: typeof body.officeAddress === 'string' ? body.officeAddress : '',
      city: typeof body.city === 'string' ? body.city : '',
      state: typeof body.state === 'string' ? body.state : '',
      pinCode: typeof body.pinCode === 'string' ? body.pinCode : '',
      experienceYears: body.experienceYears,
      specializations: Array.isArray(body.specializations) ? body.specializations : [],
      serviceCities: Array.isArray(body.serviceCities) ? body.serviceCities : [],
      languages: Array.isArray(body.languages) ? body.languages : ['English'],
      registrationNumber: typeof body.registrationNumber === 'string' ? body.registrationNumber : undefined,
      panNumber: typeof body.panNumber === 'string' ? body.panNumber : undefined,
      logo: typeof body.logo === 'string' ? body.logo : undefined,
      coverImage: typeof body.coverImage === 'string' ? body.coverImage : undefined,
    })
    const errors = validateAdminBrokerInput(input)

    if (errors.length > 0) {
      return NextResponse.json({ message: errors[0], errors }, { status: 422 })
    }

    const duplicate = await prisma.broker.findFirst({
      where: {
        OR: [
          ...(input.email ? [{ email: input.email }] : []),
          { phone: input.phone },
          ...(input.registrationNumber ? [{ registrationNumber: input.registrationNumber }] : []),
        ],
      },
      select: { id: true },
    })

    if (duplicate) {
      return NextResponse.json({ message: 'A broker with these details already exists' }, { status: 409 })
    }

    const broker = await prisma.$transaction(async (tx) => {
      const baseSlug = slugifyAdminBroker(input.companyName || input.displayName)
      let profileSlug = baseSlug
      let suffix = 2

      while (await tx.broker.findUnique({ where: { profileSlug } })) {
        profileSlug = `${baseSlug}-${suffix}`
        suffix += 1
      }

      return tx.broker.create({
        data: {
          userId: adminCreatedBrokerDefaults.userId,
          creationSource: adminCreatedBrokerDefaults.creationSource,
          displayName: input.displayName,
          companyName: input.companyName,
          profileSlug,
          logo: input.logo,
          coverImage: input.coverImage,
          description: input.description,
          phone: input.phone,
          email: input.email,
          website: input.website,
          officeAddress: input.officeAddress,
          city: input.city,
          state: input.state,
          pinCode: input.pinCode,
          experienceYears: input.experienceYears,
          specializations: input.specializations,
          serviceCities: input.serviceCities,
          languages: input.languages,
          registrationNumber: input.registrationNumber,
          panNumber: input.panNumber,
          verificationStatus: adminCreatedBrokerDefaults.verificationStatus,
          brokerStatus: adminCreatedBrokerDefaults.brokerStatus,
          isVisible: adminCreatedBrokerDefaults.isVisible,
          subscription: {
            create: {
              plan: adminCreatedBrokerDefaults.subscriptionPlan,
              isActive: adminCreatedBrokerDefaults.subscriptionActive,
              startDate: new Date(),
              endDate: null,
              stripeCustomerId: null,
              stripeSubId: null,
            },
          },
        },
        include: { subscription: true },
      })
    })

    console.info('Admin broker profile created', { adminId: admin.id, brokerId: broker.id })
    return NextResponse.json({ broker }, { status: 201 })
  } catch (error) {
    console.error('Admin broker creation failed', error)
    return NextResponse.json({ message: 'Unable to create broker profile' }, { status: 500 })
  }
}
