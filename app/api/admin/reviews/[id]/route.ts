import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import prisma from '@/lib/prisma'
import { recalculateBrokerRating } from '@/lib/reviews'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await getCurrentUser()
    if (admin?.role !== 'ADMIN') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const action = body.action
    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ message: 'Invalid action' }, { status: 400 })
    }

    const review = await prisma.review.findUnique({ where: { id }, select: { id: true, brokerId: true, status: true } })
    if (!review) {
      return NextResponse.json({ message: 'Review not found' }, { status: 404 })
    }

    const nextStatus = action === 'approve' ? 'APPROVED' : 'REJECTED'
    await prisma.review.update({ where: { id }, data: { status: nextStatus } })

    // Recompute the broker's public rating/count from APPROVED reviews only.
    const { avgRating, totalReviews } = await recalculateBrokerRating(review.brokerId)

    return NextResponse.json({
      success: true,
      message: action === 'approve' ? 'Review approved successfully.' : 'Review rejected successfully.',
      status: nextStatus,
      avgRating,
      totalReviews,
    })
  } catch (error) {
    console.error('PATCH /api/admin/reviews/[id] error:', error)
    return NextResponse.json({ message: 'Unable to update review. Please try again.' }, { status: 500 })
  }
}
