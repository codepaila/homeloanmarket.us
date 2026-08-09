// app/api/brokers/featured/route.ts
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { toPublicBrokerRecord } from '@/lib/public-broker'

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
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            image: true,
            isActive: true,
          },
        },
        bankPartners: {
          select: {
            id: true,
            bankName: true,
            bankType: true,
          },
        },
        subscription: {
          select: {
            plan: true,
            isActive: true,
            endDate: true,
          },
        },
      },
      orderBy: [
        { featuredRank: 'desc' },
        { avgRating: 'desc' },
        { totalReviews: 'desc' },
      ],
      take: 20,
    })

    // Every featured broker is a paid FEATURED subscriber (filtered above), so
    // they are entitled to contact display. Still, never leak the raw broker or
    // the account user object — apply the canonical public DTO.
    return NextResponse.json({
      brokers: brokers.map((broker) => toPublicBrokerRecord(broker, { includeContact: true })),
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
