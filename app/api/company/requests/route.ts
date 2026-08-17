import { NextRequest, NextResponse } from 'next/server'
import { getCurrentCompany } from '@/lib/company-policy'
import { isSameOriginRequest } from '@/lib/origin'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export async function GET() {
  const current = await getCurrentCompany()
  if (!current) return NextResponse.json({ error: 'Company access required' }, { status: 403 })
  const requests = await prisma.companyAdRequest.findMany({ where: { companyId: current.company.id }, orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ requests })
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  const current = await getCurrentCompany()
  if (!current) return NextResponse.json({ error: 'Company access required' }, { status: 403 })
  const body = await request.json()
  const details = typeof body.requestDetails === 'string' ? body.requestDetails.trim() : ''
  if (!details) return NextResponse.json({ error: 'Advertising request details are required' }, { status: 400 })

  // Optional location targeting captured with the request (mirrors the
  // AdvertisementLocationTarget shape). The admin uses this to pre-fill the
  // advertisement's location target.
  const target = body.location as {
    locationLabel?: unknown
    city?: unknown
    state?: unknown
    zip?: unknown
    googlePlaceId?: unknown
    latitude?: unknown
    longitude?: unknown
    radiusMiles?: unknown
  } | undefined
  const targetLocation =
    target && typeof target === 'object'
      ? {
          locationLabel: typeof target.locationLabel === 'string' ? target.locationLabel : '',
          city: typeof target.city === 'string' ? target.city : '',
          state: typeof target.state === 'string' ? target.state : '',
          zip: typeof target.zip === 'string' ? target.zip : '',
          googlePlaceId: typeof target.googlePlaceId === 'string' ? target.googlePlaceId : '',
          latitude: typeof target.latitude === 'number' ? target.latitude : null,
          longitude: typeof target.longitude === 'number' ? target.longitude : null,
          radiusMiles: typeof target.radiusMiles === 'number' ? target.radiusMiles : null,
        }
      : undefined

  const requestRecord = await prisma.companyAdRequest.create({
    data: {
      companyId: current.company.id,
      requestedById: current.user.id,
      requestDetails: details,
      targetLocation: targetLocation as unknown as Prisma.InputJsonValue | undefined,
    },
  })
  return NextResponse.json({ success: true, request: requestRecord }, { status: 201 })
}
