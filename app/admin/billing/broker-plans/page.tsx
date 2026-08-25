import Link from 'next/link'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/currentUser'
import { brokerFeatureLabel } from '@/lib/broker-plans'

export const dynamic = 'force-dynamic'

function formatPrice(cents: number, currency: string) {
  const value = cents / 100
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'usd' }).format(value)
  } catch {
    return `$${value}`
  }
}

export default async function AdminBrokerPlansPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') redirect('/auth/signin')

  const plans = await prisma.brokerSubscriptionPlan.findMany({
    include: {
      features: true,
      _count: { select: { subscriptions: true } },
    },
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
  })

  const activeSubscribers = await prisma.brokerSubscription.groupBy({
    by: ['planId'],
    where: { isActive: true },
    _count: { _all: true },
  })
  const activeCountByPlan = new Map(activeSubscribers.map((row) => [row.planId, row._count._all]))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Billing</p>
          <h1 className="text-3xl font-semibold tracking-tight">Broker Subscription Plans</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage broker subscription plans, pricing, features, and Stripe mapping.</p>
        </div>
        <Link href="/admin/billing/broker-plans/new" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Create Plan</Link>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Interval</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Active subscribers</th>
              <th className="px-4 py-3">Stripe</th>
              <th className="px-4 py-3">Features</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {plans.map((plan) => {
              const featureCodes = plan.features.filter((feature) => feature.enabled).map((feature) => feature.code)
              return (
                <tr key={plan.id}>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-text-main">{plan.name}</div>
                    <div className="text-xs text-muted-foreground">{plan.code}</div>
                  </td>
                  <td className="px-4 py-3">{plan.price > 0 ? formatPrice(plan.price, plan.currency) : 'Free'}</td>
                  <td className="px-4 py-3 capitalize">{plan.billingInterval}</td>
                  <td className="px-4 py-3">
                    <span className={plan.isActive ? 'rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600' : 'rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground'}>
                      {plan.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">{activeCountByPlan.get(plan.id) ?? 0}</td>
                  <td className="px-4 py-3">
                    {plan.stripePriceId ? (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Connected</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not connected</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {featureCodes.length > 0 ? featureCodes.map((code) => (
                        <span key={code} className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{brokerFeatureLabel(code)}</span>
                      )) : <span className="text-xs text-muted-foreground">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/billing/broker-plans/${plan.id}`} className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-text-main">Manage</Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}