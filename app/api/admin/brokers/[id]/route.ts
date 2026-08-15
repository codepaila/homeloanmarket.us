import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { resolveBrokerLocation } from '@/lib/location/broker-location'

async function isAdmin() {
  const user = await getCurrentUser()
  return user?.role === 'ADMIN'
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin())) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  const { id } = await params

  const broker = await prisma.broker.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, isActive: true } },
      subscription: true,
      claim: {
        select: {
          id: true,
          status: true,
          startedAt: true,
          completedAt: true,
          invitations: {
            select: { id: true, recipientEmail: true, status: true, expiresAt: true, usedAt: true, revokedAt: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
          },
          events: {
            select: { id: true, eventType: true, occurredAt: true, metadata: true },
            orderBy: { occurredAt: 'desc' },
            take: 50,
          },
        },
      },
    },
  })

  if (!broker) return NextResponse.json({ message: 'Broker not found' }, { status: 404 })
  return NextResponse.json({ broker })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getCurrentUser()
  if (admin?.role !== 'ADMIN') return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const broker = await prisma.broker.findUnique({ where: { id }, select: { id: true, officeAddress: true, city: true, state: true, pinCode: true } })
  if (!broker) return NextResponse.json({ message: 'Broker not found' }, { status: 404 })

  const body = await request.json()
  const allowedFields = [
    'displayName', 'companyName', 'nmls', 'description', 'phone', 'email', 'website',
    'officeAddress', 'city', 'state', 'pinCode', 'experienceYears',
    'registrationNumber', 'panNumber', 'logo', 'coverImage', 'isVisible', 'verificationStatus',
  ] as const
  const data: Record<string, unknown> = {}

  for (const field of allowedFields) {
    if (body[field] !== undefined) data[field] = body[field]
  }

  if (data.email !== undefined && data.email !== null) data.email = String(data.email).trim().toLowerCase()
  if (data.website !== undefined && data.website !== null) data.website = String(data.website).trim()
  if (data.verificationStatus !== undefined && !['UNVERIFIED', 'VERIFIED'].includes(String(data.verificationStatus))) {
    return NextResponse.json({ message: 'Invalid verification status' }, { status: 422 })
  }

  const addressFields = ['officeAddress', 'city', 'state', 'pinCode'] as const
  const normalizeAddressValue = (value: unknown) => (value === null || value === undefined ? '' : String(value).trim())
  const addressChanged = addressFields.some((field) => {
    if (data[field] === undefined) return false
    return normalizeAddressValue(data[field]) !== normalizeAddressValue(broker[field])
  })

  if (addressChanged) {
    console.info('[LOCATION] resolving broker address', { brokerId: id })
    const patch = await resolveBrokerLocation({
      officeAddress: String(data.officeAddress ?? broker.officeAddress),
      city: (data.city ?? broker.city) as string | null,
      state: (data.state ?? broker.state) as string | null,
      pinCode: (data.pinCode ?? broker.pinCode) as string | null,
    })
    if (patch) {
      console.info('[LOCATION] resolved broker address', { brokerId: id, latitude: patch.location.coordinates[1], longitude: patch.location.coordinates[0] })
      data.normalizedAddress = patch.normalizedAddress
      data.googlePlaceId = patch.googlePlaceId
      data.locationCountryCode = patch.locationCountryCode
      data.location = patch.location
    } else {
      data.location = Prisma.DbNull
      data.normalizedAddress = null
      data.googlePlaceId = null
    }
  }

  try {
    const updatedBroker = await prisma.broker.update({ where: { id }, data })
    console.info('Admin broker profile updated', { adminId: admin.id, brokerId: id })
    return NextResponse.json({ broker: updatedBroker })
  } catch (error) {
    console.error('Admin broker update failed', error)
    return NextResponse.json({ message: 'Unable to update broker profile' }, { status: 500 })
  }
}
