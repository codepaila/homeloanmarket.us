// app/api/brokers/[slug]/reviews/route.ts
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { isPublicBroker } from '@/lib/broker-policy'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10') || 10))
    const skip = (page - 1) * limit

    const slug = (await params).slug

    const broker = await prisma.broker.findUnique({
      where: { profileSlug: slug },
      select: { id: true, avgRating: true, isVisible: true, verificationStatus: true, brokerStatus: true, userId: true, user: { select: { isActive: true } } }
    })

    if (!broker) {
      return NextResponse.json(
        { message: 'Broker not found' },
        { status: 404 }
      )
    }

    if (!isPublicBroker({
      isVisible: broker.isVisible,
      verificationStatus: broker.verificationStatus,
      brokerStatus: broker.brokerStatus,
      userId: broker.userId,
      userIsActive: broker.user?.isActive,
    })) {
      return NextResponse.json({ message: 'Broker profile not available' }, { status: 404 })
    }

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: {
          brokerId: broker.id,
          isPublished: true
        },
        include: {
          user: {
            select: {
              name: true,
              image: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.review.count({
        where: {
          brokerId: broker.id,
          isPublished: true
        }
      })
    ])

    return NextResponse.json({
      reviews: reviews.map((review) => ({
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        user: review.user ? { name: review.user.name, image: review.user.image } : null,
      })),
      total,
      avgRating: broker.avgRating,
      currentPage: page,
      totalPages: Math.ceil(total / limit)
    })
  } catch (error: unknown) {
    console.error('GET /api/brokers/[slug]/reviews error:', error)
    return NextResponse.json(
      { message: 'Failed to fetch reviews', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
