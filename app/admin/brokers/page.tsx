/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from 'next/link'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/currentUser'
import AdminBulkInvitations from './AdminBulkInvitations'

const PAGE_SIZE = 25

type SearchParams = {
  search?: string
  ownership?: string
  verification?: string
  status?: string
  source?: string
  invitation?: string
  state?: string
  city?: string
  page?: string
}

export default async function AdminBrokersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') redirect('/auth/signin')

  const filters = await searchParams
  const page = Math.max(1, Number.parseInt(filters.page || '1') || 1)

  const where: any = {}
  if (filters.search) {
    where.OR = [
      { displayName: { contains: filters.search, mode: 'insensitive' } },
      { companyName: { contains: filters.search, mode: 'insensitive' } },
      { profileSlug: { contains: filters.search, mode: 'insensitive' } },
      { nmls: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
      { phone: { contains: filters.search, mode: 'insensitive' } },
    ]
  }
  if (filters.ownership === 'UNOWNED') where.userId = null
  if (filters.ownership === 'OWNED') where.userId = { not: null }
  if (filters.verification) where.verificationStatus = filters.verification
  if (filters.status) where.brokerStatus = filters.status
  if (filters.source) where.creationSource = filters.source
  if (filters.state) where.state = { contains: filters.state, mode: 'insensitive' }
  if (filters.city) where.city = { contains: filters.city, mode: 'insensitive' }
  if (filters.invitation === 'NOT_INVITED') where.claim = { is: null }
  else if (filters.invitation) where.claim = { status: filters.invitation }

  const [total, owned, unowned, invitationsPending, invitationsAccepted, invitationFailures, brokers] = await Promise.all([
    prisma.broker.count({ where }),
    prisma.broker.count({ where: { userId: { not: null } } }),
    prisma.broker.count({ where: { userId: null } }),
    prisma.broker.count({ where: { claim: { status: 'INVITED' } } }),
    prisma.broker.count({ where: { claim: { status: 'COMPLETED' } } }),
    prisma.broker.count({ where: { claim: { status: 'FAILED' } } }),
    prisma.broker.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        subscription: { select: { plan: true, isActive: true } },
        claim: {
          select: {
            status: true,
            invitations: {
              select: { id: true, recipientEmail: true, status: true, expiresAt: true, createdAt: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    }),
  ])

  const metrics = [
    { label: 'Total Brokers', value: total },
    { label: 'Owned', value: owned },
    { label: 'Unowned', value: unowned },
    { label: 'Invitations Pending', value: invitationsPending },
    { label: 'Invitations Accepted', value: invitationsAccepted },
    { label: 'Invitation Failures', value: invitationFailures },
  ]

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const brokerRows = brokers.map((broker) => ({
    id: broker.id,
    displayName: broker.displayName,
    companyName: broker.companyName,
    nmls: broker.nmls,
    email: broker.email,
    profileSlug: broker.profileSlug,
    userId: broker.userId,
    creationSource: broker.creationSource,
    brokerStatus: broker.brokerStatus,
    verificationStatus: broker.verificationStatus,
    isVisible: broker.isVisible,
    subscription: broker.subscription ? { plan: broker.subscription.plan, isActive: broker.subscription.isActive } : null,
    claimStatus: broker.claim?.status || null,
    latestInvitation: broker.claim?.invitations[0]
      ? {
          id: broker.claim.invitations[0].id,
          recipientEmail: broker.claim.invitations[0].recipientEmail,
          status: broker.claim.invitations[0].status,
          expiresAt: broker.claim.invitations[0].expiresAt?.toISOString() || null,
          createdAt: broker.claim.invitations[0].createdAt.toISOString(),
        }
      : null,
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Administration</p>
          <h1 className="text-3xl font-semibold tracking-tight">Broker Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage broker profiles, ownership, invitations, verification, and bulk operations.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/brokers/create" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Create Broker</Link>
          <Link href="/admin/brokers/import" className="rounded-lg border px-4 py-2 text-sm font-semibold">Import Brokers</Link>
          <Link href="/api/admin/brokers/export?format=csv" className="rounded-lg border px-4 py-2 text-sm font-semibold">Export CSV</Link>
          <Link href="/api/admin/brokers/export?format=xlsx" className="rounded-lg border px-4 py-2 text-sm font-semibold">Export XLSX</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-xl border bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{metric.label}</p>
            <p className="mt-2 text-2xl font-semibold">{metric.value}</p>
          </div>
        ))}
      </div>

      <form className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-3 lg:grid-cols-4" method="get">
        <input name="search" defaultValue={filters.search || ''} placeholder="Search name, company, NMLS, email, phone, slug" className="rounded-lg border bg-background px-3 py-2 text-sm sm:col-span-2" />
        <select name="ownership" defaultValue={filters.ownership || ''} className="rounded-lg border bg-background px-3 py-2 text-sm">
          <option value="">All ownership</option>
          <option value="UNOWNED">Unowned</option>
          <option value="OWNED">Owned</option>
        </select>
        <select name="invitation" defaultValue={filters.invitation || ''} className="rounded-lg border bg-background px-3 py-2 text-sm">
          <option value="">All invitations</option>
          <option value="NOT_INVITED">Not invited</option>
          <option value="INVITED">Invitation sent</option>
          <option value="IN_PROGRESS">Claim in progress</option>
          <option value="COMPLETED">Claimed</option>
          <option value="EXPIRED">Expired</option>
          <option value="REVOKED">Revoked</option>
          <option value="FAILED">Failed</option>
        </select>
        <select name="verification" defaultValue={filters.verification || ''} className="rounded-lg border bg-background px-3 py-2 text-sm">
          <option value="">All verification</option>
          <option value="VERIFIED">Verified</option>
          <option value="UNVERIFIED">Pending</option>
        </select>
        <select name="status" defaultValue={filters.status || ''} className="rounded-lg border bg-background px-3 py-2 text-sm">
          <option value="">All broker status</option>
          <option value="FREE">Active</option>
          <option value="FEATURED">Featured</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
        <select name="source" defaultValue={filters.source || ''} className="rounded-lg border bg-background px-3 py-2 text-sm">
          <option value="">All sources</option>
          <option value="ADMIN_CREATED">Admin created</option>
          <option value="SELF_REGISTERED">Registration</option>
        </select>
        <input name="state" defaultValue={filters.state || ''} placeholder="State" className="rounded-lg border bg-background px-3 py-2 text-sm" />
        <input name="city" defaultValue={filters.city || ''} placeholder="City" className="rounded-lg border bg-background px-3 py-2 text-sm" />
        <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Apply Filters</button>
        <Link href="/admin/brokers" className="inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium">Reset</Link>
      </form>

      <AdminBulkInvitations brokers={brokerRows} />

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Page {page} of {totalPages} · {total} brokers</p>
          <div className="flex gap-2">
            {page > 1 && <Link href={`/admin/brokers?${pageQuery(filters, page - 1)}`} className="rounded-lg border px-3 py-2 text-sm font-medium">Previous</Link>}
            {page < totalPages && <Link href={`/admin/brokers?${pageQuery(filters, page + 1)}`} className="rounded-lg border px-3 py-2 text-sm font-medium">Next</Link>}
          </div>
        </div>
      )}
    </div>
  )
}

function pageQuery(filters: SearchParams, page: number) {
  const params = new URLSearchParams()
  for (const key of ['search', 'ownership', 'verification', 'status', 'source', 'invitation', 'state', 'city'] as const) {
    const value = filters[key]
    if (value) params.set(key, value)
  }
  if (page > 1) params.set('page', String(page))
  return params.toString()
}
