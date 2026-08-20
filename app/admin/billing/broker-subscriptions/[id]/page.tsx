import { notFound, redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/currentUser'
import BrokerSubscriptionDetailClient from './BrokerSubscriptionDetailClient'

export const dynamic = 'force-dynamic'

export default async function AdminBrokerSubscriptionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') redirect('/auth/signin')
  const { id } = await params

  const subscription = await prisma.brokerSubscription.findUnique({
    where: { id },
    include: {
      broker: {
        select: {
          id: true,
          displayName: true,
          email: true,
          companyName: true,
          profileSlug: true,
          creationSource: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
      planRef: { include: { features: true } },
    },
  })
  if (!subscription) notFound()

  // Determine migration status and matching dynamic plan (without linking).
  let matchingPlan = null
  let migrationStatus: 'linked' | 'legacy-eligible' | 'unknown' | 'no-plan' | 'ambiguous'
  if (subscription.planId) {
    migrationStatus = 'linked'
  } else {
    const plans = await prisma.brokerSubscriptionPlan.findMany({
      where: { code: subscription.plan },
      include: { features: true },
    })
    const activePlans = plans.filter((plan) => plan.isActive)
    if (plans.length === 0) migrationStatus = 'no-plan'
    else if (activePlans.length === 1) {
      migrationStatus = 'legacy-eligible'
      matchingPlan = activePlans[0]
    } else migrationStatus = 'ambiguous'
  }

  const entitlements = subscription.planRef
    ? Object.fromEntries(subscription.planRef.features.map((feature) => [feature.code, feature.enabled]))
    : {}

  return (
    <BrokerSubscriptionDetailClient
      subscription={{
        ...subscription,
        startDate: subscription.startDate?.toISOString() ?? null,
        endDate: subscription.endDate?.toISOString() ?? null,
        broker: {
          ...subscription.broker,
          createdAt: subscription.broker.createdAt.toISOString(),
        },
      }}
      migrationStatus={migrationStatus}
      matchingPlan={matchingPlan ? { id: matchingPlan.id, code: matchingPlan.code, name: matchingPlan.name, isActive: matchingPlan.isActive } : null}
      entitlements={entitlements}
    />
  )
}