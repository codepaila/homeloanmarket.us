// Shared review moderation helpers. Canonical source of truth for review
// status semantics and broker rating recalculation. Used by the public GET,
// customer POST, and admin moderation endpoints so rating/count math is never
// duplicated.

import prisma from "@/lib/prisma"
import { ReviewStatus } from "@prisma/client"

export const REVIEW_PUBLIC_STATUS = "APPROVED" as const

export const REVIEW_CONTENT_MIN = 10
export const REVIEW_CONTENT_MAX = 2000

export function isPublicReviewStatus(status: string): boolean {
  return status === REVIEW_PUBLIC_STATUS
}

// Recompute avgRating + totalReviews from APPROVED reviews only, persist them
// on the broker, and return the new values. Called once after any approve or
// reject so public ratings never count pending/rejected reviews.
export async function recalculateBrokerRating(brokerId: string): Promise<{ avgRating: number; totalReviews: number }> {
  const aggregate = await prisma.review.aggregate({
    where: { brokerId, status: REVIEW_PUBLIC_STATUS as ReviewStatus },
    _avg: { rating: true },
    _count: { _all: true },
  })
  const avgRating = aggregate._avg.rating || 0
  const totalReviews = aggregate._count._all
  await prisma.broker.update({
    where: { id: brokerId },
    data: { avgRating, totalReviews },
  })
  return { avgRating, totalReviews }
}
