import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/currentUser'
import { auditAdminCreatedBrokerSubscriptions } from '@/lib/broker-plans'
import BrokerSubscriptionsClient from './BrokerSubscriptionsClient'

export const dynamic = 'force-dynamic'

export default async function AdminBrokerSubscriptionsPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') redirect('/auth/signin')

  const subscriptions = await prisma.brokerSubscription.findMany({
    include: {
      broker: { select: { id: true, displayName: true, email: true, companyName: true, creationSource: true } },
      planRef: { select: { id: true, code: true, name: true, isActive: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  const dynamicPlans = await prisma.brokerSubscriptionPlan.findMany({ select: { id: true, code: true } })
  const codeSet = new Set(dynamicPlans.map((plan) => plan.code))

  const rows = subscriptions.map((subscription) => {
    let migrationStatus: 'linked' | 'legacy-eligible' | 'unknown'
    if (subscription.planId) migrationStatus = 'linked'
    else if (codeSet.has(subscription.plan)) migrationStatus = 'legacy-eligible'
    else migrationStatus = 'unknown'
    return { ...subscription, migrationStatus }
  })

  const summary = {
    total: subscriptions.length,
    active: subscriptions.filter((subscription) => subscription.isActive).length,
    linked: rows.filter((row) => row.migrationStatus === 'linked').length,
    needsMigration: rows.filter((row) => row.migrationStatus === 'legacy-eligible').length,
    unknownPlan: rows.filter((row) => row.migrationStatus === 'unknown').length,
    stripeBacked: subscriptions.filter((subscription) => subscription.stripeSubId).length,
  }

  const adminAudit = await auditAdminCreatedBrokerSubscriptions()

  return <BrokerSubscriptionsClient subscriptions={rows} summary={summary} adminAudit={adminAudit} />
}