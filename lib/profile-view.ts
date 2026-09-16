import prisma from '@/lib/prisma'
import { profileViewDedup } from '@/lib/rateLimit'

// Records a public profile view for a broker.
//
// The write is gated by a distributed per-(broker, client) dedup so a single
// client cannot generate an unbounded write stream against the public profile
// endpoints. The existing profileViews counter is preserved for legitimate
// views; no new analytics model is introduced.
//
// Profile-view analytics is explicitly non-critical: any failure (including an
// unavailable limiter/Redis) is swallowed so profile retrieval never fails.
export async function recordProfileView(brokerId: string, clientKey: string): Promise<void> {
  try {
    const { success } = await profileViewDedup.limit(`profile-view:${brokerId}:${clientKey}`)
    if (!success) return
    await prisma.broker.update({
      where: { id: brokerId },
      data: { profileViews: { increment: 1 } },
    })
  } catch (error) {
    console.warn('Profile view recording skipped', {
      brokerId,
      error: error instanceof Error ? error.message : 'unknown',
    })
  }
}
