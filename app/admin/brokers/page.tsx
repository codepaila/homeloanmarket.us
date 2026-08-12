/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from 'next/link'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/currentUser'
import AdminBulkInvitations from './AdminBulkInvitations'

export default async function AdminBrokersPage({ searchParams }: { searchParams: Promise<{ search?: string; ownership?: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') redirect('/auth/signin')

  const filters = await searchParams
  const where: any = {}
  if (filters.search) {
    where.OR = [
      { displayName: { contains: filters.search, mode: 'insensitive' } },
      { companyName: { contains: filters.search, mode: 'insensitive' } },
      { profileSlug: { contains: filters.search, mode: 'insensitive' } },
      { nmls: { contains: filters.search, mode: 'insensitive' } },
    ]
  }
  if (filters.ownership === 'UNOWNED') where.userId = null
  if (filters.ownership === 'OWNED') where.userId = { not: null }

  const brokers = await prisma.broker.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      subscription: { select: { plan: true, isActive: true } },
      claim: {
        select: {
          status: true,
          invitations: {
            select: { recipientEmail: true, status: true, expiresAt: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Administration</p>
          <h1 className="text-3xl font-semibold tracking-tight">Broker Profiles</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create and prepare unowned profiles for future claiming.</p>
        </div>
         <div className="flex flex-wrap gap-2"><Link href="/admin/brokers/create" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Create Broker</Link><Link href="/admin/brokers/import" className="rounded-lg border px-4 py-2 text-sm font-semibold">Import</Link><Link href="/api/admin/brokers/export?format=csv" className="rounded-lg border px-4 py-2 text-sm font-semibold">Export CSV</Link><Link href="/api/admin/brokers/export?format=xlsx" className="rounded-lg border px-4 py-2 text-sm font-semibold">Export XLSX</Link></div>
      </div>

      <form className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row" method="get">
         <input name="search" defaultValue={filters.search || ''} placeholder="Search name, company, NMLS, or slug" className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm" />
        <select name="ownership" defaultValue={filters.ownership || ''} className="rounded-lg border bg-background px-3 py-2 text-sm">
          <option value="">All ownership</option>
          <option value="UNOWNED">Unowned</option>
          <option value="OWNED">Owned</option>
        </select>
        <button className="rounded-lg border px-4 py-2 text-sm font-medium">Filter</button>
      </form>

      <AdminBulkInvitations brokers={brokers.map((broker) => ({
        id: broker.id,
        displayName: broker.displayName,
        companyName: broker.companyName,
        userId: broker.userId,
        creationSource: broker.creationSource,
        brokerStatus: broker.brokerStatus,
      }))} />

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Profile</th>
              <th className="px-4 py-3">Ownership</th>
              <th className="px-4 py-3">Verification</th>
              <th className="px-4 py-3">Subscription</th>
              <th className="px-4 py-3">Visibility</th>
              <th className="px-4 py-3">Claim</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {brokers.map((broker) => {
              const invitation = broker.claim?.invitations[0]
              return (
                <tr key={broker.id} className="align-top">
                  <td className="px-4 py-4">
                    <Link href={`/admin/brokers/${broker.id}`} className="font-semibold hover:underline">
                      {broker.companyName || broker.displayName}
                    </Link>
                    <p className="text-xs text-muted-foreground">{broker.profileSlug}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{broker.creationSource || 'SOURCE NOT CLASSIFIED'}</p>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${broker.userId ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {broker.userId ? 'OWNED' : 'UNOWNED'}
                    </span>
                  </td>
                  <td className="px-4 py-4">{broker.verificationStatus}</td>
                  <td className="px-4 py-4">{broker.subscription?.plan || 'FREE'}{broker.subscription?.isActive === false ? ' / INACTIVE' : ''}</td>
                  <td className="px-4 py-4">{broker.isVisible ? 'PUBLISHED' : 'UNPUBLISHED'}</td>
                  <td className="px-4 py-4">
                    {broker.claim?.status || 'NOT_STARTED'}
                    {invitation && <p className="text-xs text-muted-foreground">{invitation.status}</p>}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <Link href={`/admin/brokers/${broker.id}`} className="font-medium text-primary hover:underline">Open</Link>
                  </td>
                </tr>
              )
            })}
            {brokers.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">No broker profiles have been created.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
