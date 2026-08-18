// app/api/brokers/[slug]/reviews/route.ts
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import prisma from '@/lib/prisma'
import { isPublicBroker } from '@/lib/broker-policy'
import { REVIEW_CONTENT_MIN, REVIEW_CONTENT_MAX, REVIEW_PUBLIC_STATUS } from '@/lib/reviews'

function loadBroker(slug: string) {
  return prisma.broker.findUnique({
    where: { profileSlug: slug },
    select: { id: true, avgRating: true, isVisible: true, verificationStatus: true, brokerStatus: true, creationSource: true, userId: true, user: { select: { isActive: true } } },
  })
}

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

    const broker = await loadBroker(slug)

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
      creationSource: broker.creationSource,
      userId: broker.userId,
      userIsActive: broker.user?.isActive,
    })) {
      return NextResponse.json({ message: 'Broker profile not available' }, { status: 404 })
    }

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: {
          brokerId: broker.id,
          status: REVIEW_PUBLIC_STATUS,
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
          status: REVIEW_PUBLIC_STATUS,
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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user?.id) {
      return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
    }

    const slug = (await params).slug
    const broker = await loadBroker(slug)
    if (!broker) {
      return NextResponse.json({ message: 'Broker not found' }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))
    const rating = body.rating
    const comment = typeof body.comment === 'string' ? body.comment.trim() : ''
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ message: 'Rating must be between 1 and 5 stars' }, { status: 422 })
    }
    if (comment.length === 0) {
      return NextResponse.json({ message: 'Please write a short review.' }, { status: 422 })
    }
    if (comment.length < REVIEW_CONTENT_MIN || comment.length > REVIEW_CONTENT_MAX) {
      return NextResponse.json({ message: `Review must be between ${REVIEW_CONTENT_MIN} and ${REVIEW_CONTENT_MAX} characters` }, { status: 422 })
    }

    // One active (pending/approved) review per user per broker. A rejected
    // review may be resubmitted.
    const existing = await prisma.review.findFirst({
      where: { brokerId: broker.id, userId: user.id, status: { in: ['PENDING', 'APPROVED'] } },
      select: { id: true },
    })
    if (existing) {
      return NextResponse.json({ message: 'You have already reviewed this broker.' }, { status: 409 })
    }

    // New reviews start PENDING and do not affect the public rating until approved.
    const review = await prisma.review.create({
      data: { brokerId: broker.id, userId: user.id, rating, comment, status: 'PENDING' },
      select: { id: true, rating: true, comment: true, createdAt: true, status: true },
    })

    return NextResponse.json({
      success: true,
      message: 'Thank you! Your review has been submitted and is pending admin approval.',
      review,
    }, { status: 201 })
  } catch (error: unknown) {
    console.error('POST /api/brokers/[slug]/reviews error:', error)
    return NextResponse.json(
      { message: 'Unable to submit your review. Please try again.' },
      { status: 500 }
    )
  }
}
