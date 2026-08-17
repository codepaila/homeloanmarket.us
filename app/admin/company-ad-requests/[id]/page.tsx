'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { ArrowRight, ExternalLink, MapPin, Shield, Building2, User, CalendarDays } from 'lucide-react'
import { RequestStatusBadge } from '@/components/admin/company/RequestStatusBadge'
import { REQUEST_STATUS_ORDER, formatRequestTargetLocation } from '@/lib/advertisements/request-status'
import { cn } from '@/lib/utils'
import type { CompanyAdRequestStatus } from '@prisma/client'

type RequestData = {
  id: string
  status: CompanyAdRequestStatus
  requestDetails: string | null
  targetLocation: unknown
  createdAt: string
  reviewedAt: string | null
  company: {
    id: string
    name: string
    type: string
    status: string
    subscription: { isActive: boolean; plan: string; endDate: string | null; advertisingPlan: { name: string } | null } | null
    memberships: { id: string; role: string; user: { name: string | null; email: string | null } | null }[]
  }
  requestedBy: { id: string; name: string | null; email: string | null }
  reviewedBy: { id: string; name: string | null; email: string | null } | null
  advertisement: { id: string; title: string; placement: string; isEnabled: boolean; isArchived: boolean; startDate: string | null; endDate: string | null; company: { name: string } | null } | null
}

const STEPS = ['Requested', 'Under Review', 'Approved', 'Advertisement Created', 'Published']

function stepIndex(status: CompanyAdRequestStatus): number {
  switch (status) {
    case 'REQUESTED': return 0
    case 'UNDER_REVIEW': return 1
    case 'APPROVED': return 2
    case 'FULFILLED': return 3
    case 'REJECTED':
    case 'CANCELED': return -1
  }
}

function placementLabel(placement: string) {
  if (placement === 'BROKER_LISTING_LOCAL') return 'Broker Listing — Local'
  if (placement === 'BROKER_LISTING') return 'Broker Listing — Global'
  return placement
}

export default function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [request, setRequest] = useState<RequestData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    params.then(({ id }) => {
      fetch(`/api/admin/company-ad-requests/${id}`)
        .then(async (res) => {
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || 'Unable to load request')
          if (active) setRequest(data.request)
        })
        .catch((e) => { if (active) setError(e instanceof Error ? e.message : 'Unable to load request') })
        .finally(() => { if (active) setLoading(false) })
    })
    return () => { active = false }
  }, [params])

  async function transition(status: CompanyAdRequestStatus) {
    if (!request) return
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/company-ad-requests/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Unable to update request')
      setRequest(data.request)
      toast.success(`Request ${status.replace(/_/g, ' ').toLowerCase()}`)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Unable to update request')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <div className="py-12 text-center text-muted-foreground">Loading request…</div>
  }
  if (error || !request) {
    return <div className="py-12 text-center text-muted-foreground">{error || 'Request not found'}</div>
  }

  const location = (request.targetLocation && typeof request.targetLocation === 'object' ? request.targetLocation : {}) as { locationLabel?: string; city?: string; state?: string; zip?: string; radiusMiles?: number | null }
  const currentStep = stepIndex(request.status)
  const adActive = request.advertisement?.isEnabled && !request.advertisement?.isArchived
  const subscription = request.company.subscription

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/admin" className="hover:text-foreground">Admin</Link>
        <span>/</span>
        <Link href="/admin/company-ad-requests" className="hover:text-foreground">Advertisement Requests</Link>
        <span>/</span>
        <span className="text-foreground">REQUEST-{request.id.slice(-8).toUpperCase()}</span>
      </nav>

      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Advertisement Request</p>
          <h1 className="text-2xl font-bold tracking-tight">REQUEST-{request.id.slice(-8).toUpperCase()}</h1>
          <div className="mt-2"><RequestStatusBadge status={request.status} /></div>
        </div>
        <div className="flex flex-wrap gap-2">
          {request.status === 'REQUESTED' && (
            <button type="button" disabled={busy} onClick={() => transition('UNDER_REVIEW')} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              Review Request
            </button>
          )}
          {request.status === 'UNDER_REVIEW' && (
            <>
              <button type="button" disabled={busy} onClick={() => transition('APPROVED')} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                Approve Request
              </button>
              <button type="button" disabled={busy} onClick={() => { if (window.confirm('Reject this advertisement request?')) transition('REJECTED') }} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 disabled:opacity-50">
                Reject Request
              </button>
            </>
          )}
          {request.status === 'APPROVED' && !request.advertisement && (
            <Link href={`/admin/company-ad-requests/${request.id}/create-ad`} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              Create Advertisement <ArrowRight className="h-4 w-4" />
            </Link>
          )}
          {request.advertisement && (
            <Link href={`/admin/ads/${request.advertisement.id}/edit`} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              {adActive ? 'View Advertisement' : 'Manage Advertisement'} <ExternalLink className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>

      {/* Progress indicator */}
      <div className="rounded-xl border bg-card p-4">
        <ol className="flex flex-wrap items-center gap-2 text-xs">
          {STEPS.map((step, index) => {
            const reached = currentStep >= index
            const isCurrent = currentStep === index
            return (
              <li key={step} className="flex items-center gap-2">
                <span className={cn('flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ring-1 ring-inset', isCurrent ? 'bg-primary text-primary-foreground ring-primary' : reached ? 'bg-emerald-100 text-emerald-700 ring-emerald-200' : 'bg-muted text-muted-foreground ring-border')}>
                  {reached && !isCurrent ? '✓ ' : ''}{step}
                </span>
                {index < STEPS.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
              </li>
            )
          })}
        </ol>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        {/* LEFT — main information */}
        <div className="space-y-6">
          <section className="rounded-xl border bg-card p-5">
            <h2 className="text-lg font-semibold">Request Details</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <div><dt className="text-muted-foreground">Message</dt><dd className="mt-0.5 text-text-main">{request.requestDetails || '—'}</dd></div>
              <div><dt className="text-muted-foreground">Submitted</dt><dd className="mt-0.5 flex items-center gap-1.5 text-text-main"><CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />{new Date(request.createdAt).toLocaleString()}</dd></div>
            </dl>
          </section>

          <section className="rounded-xl border bg-card p-5">
            <h2 className="text-lg font-semibold">Requested Location</h2>
            <div className="mt-3 flex items-start gap-3 rounded-lg border bg-muted/40 p-4">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <p className="font-medium text-text-main">{formatRequestTargetLocation(location)}</p>
                <p className="mt-1 text-xs text-muted-foreground">The advertisement can appear to users searching within this location.</p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border bg-card p-5">
            <h2 className="text-lg font-semibold">Advertisement</h2>
            {request.advertisement ? (
              <div className="mt-3 space-y-2 text-sm">
                <Link href={`/admin/ads/${request.advertisement.id}/edit`} className="font-medium text-primary hover:underline">{request.advertisement.title}</Link>
                <p className="text-muted-foreground">{placementLabel(request.advertisement.placement)} · {adActive ? 'Active' : 'Disabled'}</p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Advertisement has not been created yet.</p>
            )}
          </section>
        </div>

        {/* RIGHT — context panel */}
        <div className="space-y-6">
          <section className="rounded-xl border bg-card p-5">
            <h2 className="flex items-center gap-2 text-lg font-semibold"><Building2 className="h-4 w-4 text-muted-foreground" /> Company</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Name</dt><dd className="font-medium">{request.company.name}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Type</dt><dd className="capitalize">{request.company.type.replace(/_/g, ' ')}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Status</dt><dd>{request.company.status}</dd></div>
            </dl>
          </section>

          <section className="rounded-xl border bg-card p-5">
            <h2 className="flex items-center gap-2 text-lg font-semibold"><Shield className="h-4 w-4 text-muted-foreground" /> Advertising Plan</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Plan</dt><dd className="font-medium">{subscription?.advertisingPlan?.name || '—'}</dd></div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subscription</dt>
                <dd className={subscription?.isActive ? 'font-medium text-emerald-700' : 'text-muted-foreground'}>{subscription?.isActive ? 'Active' : 'Inactive'}</dd>
              </div>
              {subscription?.endDate && <div className="flex justify-between"><dt className="text-muted-foreground">Active until</dt><dd>{new Date(subscription.endDate).toLocaleDateString()}</dd></div>}
            </dl>
          </section>

          <section className="rounded-xl border bg-card p-5">
            <h2 className="flex items-center gap-2 text-lg font-semibold"><User className="h-4 w-4 text-muted-foreground" /> Requester</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Name</dt><dd className="font-medium">{request.requestedBy.name || '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Email</dt><dd>{request.requestedBy.email || '—'}</dd></div>
            </dl>
            {request.reviewedBy && (
              <div className="mt-3 border-t pt-3 text-xs text-muted-foreground">
                Reviewed by {request.reviewedBy.name || request.reviewedBy.email} {request.reviewedAt ? `· ${new Date(request.reviewedAt).toLocaleString()}` : ''}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
