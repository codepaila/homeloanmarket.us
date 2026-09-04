import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/currentUser'
import prisma from '@/lib/prisma'
import { RequestStatusBadge } from '@/components/admin/company/RequestStatusBadge'
import { formatRequestTargetLocation } from '@/lib/advertisements/request-status'

type TargetLocation = {
  locationLabel?: string
  city?: string
  state?: string
  zip?: string
  radiusMiles?: number | null
}

function parseTarget(location: unknown): TargetLocation {
  if (!location || typeof location !== 'object') return {}
  return location as TargetLocation
}

function adBadge(ad: { isEnabled: boolean; isArchived: boolean } | null) {
  if (!ad) return <span className="text-muted-foreground">Not created</span>
  if (ad.isArchived) return <span className="text-muted-foreground">Archived</span>
  if (ad.isEnabled) return <span className="font-medium text-emerald-700">Active</span>
  return <span className="text-muted-foreground">Disabled</span>
}

export default async function AdminAdvertisementRequestsPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') redirect('/auth/signin')

  const requests = await prisma.companyAdRequest.findMany({
    orderBy: { createdAt: 'desc' },
  })

  const companyIds = [...new Set(requests.map((r) => r.companyId))]
  const adIds = [...new Set(requests.map((r) => r.advertisementId).filter((id): id is string => Boolean(id)))]
  const [companies, ads] = await Promise.all([
    prisma.company.findMany({
      where: { id: { in: companyIds } },
      select: { id: true, name: true, type: true, subscription: { include: { advertisingPlan: { select: { name: true } } } } },
    }),
    prisma.advertisement.findMany({
      where: { id: { in: adIds } },
      select: { id: true, title: true, isEnabled: true, isArchived: true },
    }),
  ])
  const companyById = new Map(companies.map((c) => [c.id, c]))
  const adById = new Map(ads.map((a) => [a.id, a]))

  const counts = {
    REQUESTED: requests.filter((r) => r.status === 'REQUESTED').length,
    UNDER_REVIEW: requests.filter((r) => r.status === 'UNDER_REVIEW').length,
    APPROVED: requests.filter((r) => r.status === 'APPROVED').length,
    REJECTED: requests.filter((r) => r.status === 'REJECTED').length,
    FULFILLED: requests.filter((r) => r.status === 'FULFILLED').length,
  }

  const summary = [
    { label: 'Requested', value: counts.REQUESTED, className: 'bg-slate-100 text-slate-700' },
    { label: 'Under Review', value: counts.UNDER_REVIEW, className: 'bg-blue-100 text-blue-700' },
    { label: 'Approved', value: counts.APPROVED, className: 'bg-emerald-100 text-emerald-700' },
    { label: 'Rejected', value: counts.REJECTED, className: 'bg-red-100 text-red-700' },
    { label: 'Fulfilled', value: counts.FULFILLED, className: 'bg-emerald-100 text-emerald-700' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Company Management</p>
        <h1 className="text-3xl font-semibold tracking-tight">Advertisement Requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">Review advertising requests submitted by companies.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {summary.map((card) => (
          <div key={card.label} className="rounded border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{card.label}</p>
            <p className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xl font-bold ${card.className}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded border bg-card">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Requested Location</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Submitted</th>
              <th className="px-4 py-3">Advertisement</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {requests.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">No advertisement requests yet.</td></tr>
            )}
            {requests.map((request) => {
              const location = parseTarget(request.targetLocation)
              const company = companyById.get(request.companyId)
              const ad = request.advertisementId ? adById.get(request.advertisementId) : undefined
              const plan = company?.subscription?.advertisingPlan?.name || '—'
              const subActive = company?.subscription?.isActive
              return (
                <tr key={request.id} className="align-top">
                  <td className="px-4 py-4">
                    <Link href={`/admin/company-ad-requests/${request.id}`} className="font-semibold hover:underline">{company?.name || '—'}</Link>
                    {company && <p className="text-xs text-muted-foreground capitalize">{company.type.replace(/_/g, ' ')}</p>}
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-medium">{plan}</p>
                    <p className={`text-xs ${subActive ? 'text-emerald-700' : 'text-muted-foreground'}`}>{subActive ? 'Active' : 'Inactive'}</p>
                  </td>
                  <td className="px-4 py-4 text-muted-foreground">{formatRequestTargetLocation(location)}</td>
                  <td className="px-4 py-4"><RequestStatusBadge status={request.status} /></td>
                  <td className="px-4 py-4 text-muted-foreground">{new Date(request.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-4">{ad ? adBadge(ad) : <span className="text-muted-foreground">Not created</span>}</td>
                  <td className="px-4 py-4 text-right">
                    <Link href={`/admin/company-ad-requests/${request.id}`} className="font-medium text-primary hover:underline">View Request</Link>
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
