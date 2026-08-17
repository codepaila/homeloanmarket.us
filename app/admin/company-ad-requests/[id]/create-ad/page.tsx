import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/currentUser'
import prisma from '@/lib/prisma'
import { AdvertisementWizard } from '@/components/admin/ads/AdvertisementWizard'
import { RequestStatusBadge } from '@/components/admin/company/RequestStatusBadge'

type TargetLocation = {
  locationLabel?: string
  city?: string
  state?: string
  zip?: string
  googlePlaceId?: string
  latitude?: number
  longitude?: number
  radiusMiles?: number | null
}

function toLocationTarget(location: unknown): { locationLabel?: string; city?: string; state?: string; zip?: string; googlePlaceId?: string; latitude?: number; longitude?: number; radiusMiles?: number } | undefined {
  if (!location || typeof location !== 'object') return undefined
  const value = location as TargetLocation
  return {
    locationLabel: value.locationLabel,
    city: value.city,
    state: value.state,
    zip: value.zip,
    googlePlaceId: value.googlePlaceId,
    latitude: value.latitude,
    longitude: value.longitude,
    radiusMiles: value.radiusMiles ?? undefined,
  }
}

export default async function CreateAdFromRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') redirect('/auth/signin')
  const { id } = await params

  const request = await prisma.companyAdRequest.findUnique({ where: { id } })
  if (!request) notFound()

  const [company, existingAd] = await Promise.all([
    prisma.company.findUnique({ where: { id: request.companyId }, select: { id: true, name: true, type: true, subscription: { include: { advertisingPlan: { select: { name: true } } } } } }),
    request.advertisementId ? prisma.advertisement.findUnique({ where: { id: request.advertisementId }, select: { id: true } }) : null,
  ])
  if (!company) notFound()
  if (existingAd) redirect(`/admin/ads/${existingAd.id}/edit`)

  const locationTarget = toLocationTarget(request.targetLocation)

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/admin" className="hover:text-foreground">Admin</Link>
        <span>/</span>
        <Link href="/admin/company-ad-requests" className="hover:text-foreground">Advertisement Requests</Link>
        <span>/</span>
        <Link href={`/admin/company-ad-requests/${id}`} className="hover:text-foreground">REQUEST-{id.slice(-8).toUpperCase()}</Link>
        <span>/</span>
        <span className="text-foreground">Create Advertisement</span>
      </nav>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Create Advertisement from Request</h1>
        <p className="mt-1 text-sm text-muted-foreground">The request context is pre-loaded. Configure the advertisement content, placement, and targeting.</p>
      </div>

      <section className="grid gap-4 rounded-xl border bg-card p-5 md:grid-cols-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Company</p>
          <p className="mt-1 font-semibold">{company.name}</p>
          <p className="text-xs capitalize text-muted-foreground">{company.type.replace(/_/g, ' ')}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Request</p>
          <p className="mt-1 text-sm">REQUEST-{id.slice(-8).toUpperCase()}</p>
          <div className="mt-1"><RequestStatusBadge status={request.status} /></div>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Request Details</p>
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{request.requestDetails || '—'}</p>
        </div>
      </section>

      <AdvertisementWizard
        companyId={company.id}
        requestId={request.id}
        initialLocationTarget={locationTarget}
      />
    </div>
  )
}

