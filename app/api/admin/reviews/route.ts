import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import prisma from '@/lib/prisma'

export async function GET(request: Request) {
  const admin = await getCurrentUser()
  if (admin?.role !== 'ADMIN') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || undefined
  const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25') || 25))
  const skip = (page - 1) * limit

  const where = status ? { status: status as never } : {}

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
        broker: { select: { id: true, displayName: true, companyName: true, profileSlug: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.review.count({ where }),
  ])

  return NextResponse.json({
    reviews: reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      status: r.status,
      createdAt: r.createdAt,
      user: r.user ? { id: r.user.id, name: r.user.name, email: r.user.email, image: r.user.image } : null,
      broker: r.broker ? { id: r.broker.id, displayName: r.broker.displayName, companyName: r.broker.companyName, profileSlug: r.broker.profileSlug } : null,
    })),
    total,
    currentPage: page,
    totalPages: Math.ceil(total / limit),
  })
}
