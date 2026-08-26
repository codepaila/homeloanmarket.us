import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/currentUser'
import prisma from '@/lib/prisma'
import { DeleteAccountDialog } from '@/components/account/DeleteAccountDialog'

function statusLabel(status: string, isActive: boolean) {
  if (status === 'CHECKOUT_PENDING') return 'Confirming'
  if (isActive) return 'Active'
  if (status === 'CANCELED') return 'Canceled'
  if (status === 'EXPIRED') return 'Expired'
  if (status === 'PAST_DUE') return 'Past due'
  return 'Inactive'
}

export default async function AdminCompaniesPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') redirect('/auth/signin')

  const companies = await prisma.company.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      subscription: {
        select: { status: true, isActive: true, plan: true },
      },
      memberships: {
        where: { isActive: true },
        select: { role: true, user: { select: { id: true, name: true, email: true } } },
      },
      _count: {
        select: { adRequests: true, advertisements: true },
      },
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Company Management</p>
        <h1 className="text-3xl font-semibold tracking-tight">Companies</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage registered companies. Deleting a company permanently removes its subscription,
          advertisement requests, advertisements, and memberships. Global advertising plans are
          never affected.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Subscription</th>
              <th className="px-4 py-3">Members</th>
              <th className="px-4 py-3">Requests / Ads</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {companies.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No companies registered yet.</td></tr>
            )}
            {companies.map((company) => (
              <tr key={company.id} className="align-top">
                <td className="px-4 py-4">
                  <p className="font-semibold">{company.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{company.type.replace(/_/g, ' ')}</p>
                </td>
                <td className="px-4 py-4">
                  <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium capitalize">{company.status.toLowerCase()}</span>
                </td>
                <td className="px-4 py-4">
                  <p className="font-medium">{company.subscription?.plan || 'No subscription'}</p>
                  <p className={`text-xs ${company.subscription?.isActive ? 'text-emerald-700' : 'text-muted-foreground'}`}>
                    {company.subscription ? statusLabel(company.subscription.status, company.subscription.isActive) : '—'}
                  </p>
                </td>
                <td className="px-4 py-4">
                  {company.memberships.length === 0 ? (
                    <span className="text-muted-foreground">None</span>
                  ) : (
                    <div className="space-y-0.5">
                      {company.memberships.map((membership) => (
                        <p key={membership.user.id} className="text-xs text-muted-foreground">
                          {membership.user.name || membership.user.email} <span className="uppercase">({membership.role})</span>
                        </p>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-4 text-muted-foreground">{company._count.adRequests} / {company._count.advertisements}</td>
                <td className="px-4 py-4 text-right">
                  <DeleteAccountDialog
                    triggerLabel="Delete"
                    title="Delete this company?"
                    description="This permanently removes the company, its subscription, advertising requests, advertisements, and membership data. Any active advertising subscription will be cancelled first."
                    endpoint={`/api/admin/companies/${company.id}/delete`}
                    method="DELETE"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
