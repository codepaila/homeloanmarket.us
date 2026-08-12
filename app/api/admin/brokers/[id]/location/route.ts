import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import prisma from '@/lib/prisma'
import { geocodeUSAddress } from '@/lib/location/google-place'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getCurrentUser()
  if (admin?.role !== 'ADMIN') return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const broker = await prisma.broker.findUnique({
    where: { id },
    select: { id: true, officeAddress: true, serviceCities: true },
  })
  if (!broker) return NextResponse.json({ message: 'Broker not found' }, { status: 404 })

  try {
    const location = await geocodeUSAddress(broker.officeAddress)
    const updated = await prisma.broker.update({
      where: { id },
      data: {
        normalizedAddress: location.normalizedAddress,
        city: location.city || undefined,
        state: location.state || undefined,
        pinCode: location.zip || undefined,
        serviceCities: broker.serviceCities.length === 0 && location.city ? [location.city] : undefined,
        googlePlaceId: location.placeId,
        locationCountryCode: location.countryCode,
        location: {
          type: 'Point',
          coordinates: [location.longitude, location.latitude],
        },
      },
      select: { id: true, normalizedAddress: true, city: true, state: true, pinCode: true, location: true },
    })
    return NextResponse.json({ success: true, broker: updated })
  } catch {
    return NextResponse.json({ message: 'Broker address could not be resolved' }, { status: 422 })
  }
}
