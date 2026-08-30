import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/currentUser'
import { formatPlanPrice } from '@/lib/company-advertising-plan'

export const dynamic = 'force-dynamic'

export default async function AdminCompanySubscriptionsPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') redirect('/auth/signin')

  const subscriptions = await prisma.companySubscription.findMany({
    include: {
      company: {
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          memberships: {
            where: { role: 'OWNER' },
            select: { user: { select: { id: true, name: true, email: true } } },
            take: 1,
          },
          adRequests: { select: { id: true, status: true }, take: 5 },
        },
      },
      advertisingPlan: { select: { name: true, price: true, currency: true, billingInterval: true, isActive: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Companies</p>
        <h1 className="text-3xl font-semibold tracking-tight">Company Subscriptions</h1>
        <p className="mt-1 text-sm text-muted-foreground">Inspect company advertising subscription and billing status.</p>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Billing</th>
              <th className="px-4 py-3">Stripe customer</th>
              <th className="px-4 py-3">Stripe subscription</th>
              <th className="px-4 py-3">Ad requests</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {subscriptions.map((sub) => (
              <tr key={sub.id}>
                <td className="px-4 py-3">
                  <div className="font-semibold text-foreground">{sub.company.name}</div>
                  <div className="text-xs text-muted-foreground">{sub.company.type}</div>
                </td>
                <td className="px-4 py-3">
                  {sub.company.memberships[0]?.user ? (
                    <div>
                      <div className="font-medium">{sub.company.memberships[0].user.name || '—'}</div>
                      <div className="text-xs text-muted-foreground">{sub.company.memberships[0].user.email}</div>
                    </div>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-3">
                  {sub.advertisingPlan ? (
                    <div>
                      <div className="font-medium">{sub.advertisingPlan.name}</div>
                      <div className="text-xs text-muted-foreground">{formatPlanPrice(sub.advertisingPlan.price, sub.advertisingPlan.currency)} / {sub.advertisingPlan.billingInterval}</div>
                    </div>
                  ) : <span className="text-xs text-muted-foreground">{sub.plan}</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={sub.isActive ? 'rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600' : 'rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground'}>
                    {sub.isActive ? 'Active' : sub.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {sub.startDate ? `Start: ${new Date(sub.startDate).toLocaleDateString()}` : '—'}
                  {sub.endDate ? <><br />End: {new Date(sub.endDate).toLocaleDateString()}</> : null}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{sub.stripeCustomerId || '—'}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{sub.stripeSubId || '—'}</td>
                <td className="px-4 py-3 text-xs">
                  <div className="flex flex-wrap gap-1">
                    {sub.company.adRequests.length > 0 ? sub.company.adRequests.map((request) => (
                      <span key={request.id} className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{request.status}</span>
                    )) : <span className="text-muted-foreground">—</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}