import Link from 'next/link'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/currentUser'
import { formatPlanPrice, getCompanyPlanStats } from '@/lib/company-advertising-plan'

export const dynamic = 'force-dynamic'

export default async function AdminCompanyAdvertisingPlansPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') redirect('/auth/signin')

  const plans = await prisma.companyAdvertisingPlan.findMany({
    include: { _count: { select: { subscriptions: true } } },
    orderBy: [{ displayOrder: 'asc' }, { price: 'asc' }, { name: 'asc' }],
  })
  const stats = await Promise.all(plans.map((plan) => getCompanyPlanStats(plan.id)))

  const [activeSubscribers, pendingRequests] = await Promise.all([
    prisma.companySubscription.count({ where: { isActive: true } }),
    prisma.companyAdRequest.count({ where: { status: 'REQUESTED' } }),
  ])

  const summaryCards = [
    { label: 'Active Plans', value: plans.filter((plan) => plan.isActive).length },
    { label: 'Inactive Plans', value: plans.filter((plan) => !plan.isActive).length },
    { label: 'Active Company Subscribers', value: activeSubscribers },
    { label: 'Pending Advertisement Requests', value: pendingRequests },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Billing</p>
          <h1 className="text-3xl font-semibold tracking-tight">Company Advertising Plans</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage company advertising subscription plans, pricing, Stripe mapping, and availability.</p>
        </div>
        <Link href="/admin/billing/company-advertising-plans/new" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Create Plan</Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded-xl border bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Interval</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Stripe Product</th>
              <th className="px-4 py-3">Stripe Price</th>
              <th className="px-4 py-3">Active subscribers</th>
              <th className="px-4 py-3">Ad requests</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {plans.map((plan, index) => (
              <tr key={plan.id}>
                <td className="px-4 py-3 font-semibold text-text-main">{plan.name}</td>
                <td className="px-4 py-3">{plan.price > 0 ? formatPlanPrice(plan.price, plan.currency) : 'Free'}</td>
                <td className="px-4 py-3 capitalize">{plan.billingInterval}</td>
                <td className="px-4 py-3">
                  <span className={plan.isActive ? 'rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600' : 'rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground'}>
                    {plan.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{plan.stripeProductId ? 'Connected' : '—'}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{plan.stripePriceId ? 'Connected' : '—'}</td>
                <td className="px-4 py-3">{stats[index].activeSubscribers}</td>
                <td className="px-4 py-3">{stats[index].adRequests}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(plan.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <Link href={`/admin/billing/company-advertising-plans/${plan.id}`} className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-text-main">Manage</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}