import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import prisma from '@/lib/prisma'
import { auditAdminCreatedBrokerSubscriptions } from '@/lib/broker-plans'

export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const subscriptions = await prisma.brokerSubscription.findMany({
    include: {
      broker: { select: { id: true, displayName: true, email: true, companyName: true, creationSource: true, profileSlug: true } },
      planRef: { select: { id: true, code: true, name: true, isActive: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  const dynamicPlans = await prisma.brokerSubscriptionPlan.findMany({ select: { id: true, code: true } })
  const codeSet = new Set(dynamicPlans.map((plan) => plan.code))

  // Compute migration status for each subscription.
  const withStatus = subscriptions.map((subscription) => {
    let migrationStatus: 'linked' | 'legacy-eligible' | 'unknown' | 'ambiguous'
    if (subscription.planId) {
      migrationStatus = 'linked'
    } else if (codeSet.has(subscription.plan)) {
      // Only a unique active plan counts as eligible; handled in detail view.
      migrationStatus = 'legacy-eligible'
    } else {
      migrationStatus = 'unknown'
    }
    return { ...subscription, migrationStatus }
  })

  const summary = {
    total: subscriptions.length,
    active: subscriptions.filter((subscription) => subscription.isActive).length,
    linked: withStatus.filter((subscription) => subscription.migrationStatus === 'linked').length,
    needsMigration: withStatus.filter((subscription) => subscription.migrationStatus === 'legacy-eligible').length,
    unknownPlan: withStatus.filter((subscription) => subscription.migrationStatus === 'unknown').length,
    stripeBacked: subscriptions.filter((subscription) => subscription.stripeSubId).length,
  }

  const adminAudit = await auditAdminCreatedBrokerSubscriptions()

  return NextResponse.json({ subscriptions: withStatus, summary, adminAudit })
}