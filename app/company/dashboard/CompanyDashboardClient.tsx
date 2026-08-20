'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { RequestStatusBadge } from '@/components/admin/company/RequestStatusBadge'
import { formatRequestTargetLocation } from '@/lib/advertisements/request-status'

type CompanyDashboardData = {
  id: string
  name: string
  address: string
  contactName: string
  contactPosition: string
  phone: string
  subscription: {
    status: string
    isActive: boolean
    stripeCustomerId: string | null
    startDate?: string | Date | null
    endDate?: string | Date | null
    plan?: { name: string; price?: number; currency?: string; billingInterval?: string } | null
  } | null
}

type CompanyRequest = {
  id: string
  status: string
  requestDetails: string | null
  targetLocation: unknown
  createdAt: string | Date
  advertisement?: { id: string; title: string } | null
}

export function CompanyDashboardClient({ company, requests }: { company: CompanyDashboardData; requests: CompanyRequest[] }) {
  const router = useRouter()
  const [requestDetails, setRequestDetails] = useState('')
  const [locationLabel, setLocationLabel] = useState('')
  const [radius, setRadius] = useState(25)
  const [busy, setBusy] = useState(false)
  const [submittedId, setSubmittedId] = useState<string | null>(null)

  async function checkout() {
    window.location.href = '/company/subscription/select'
  }

  async function portal() {
    try {
      const response = await fetch('/api/company/subscription/portal', { method: 'POST' })
      const data = await response.json()
      if (!response.ok || !data.url) throw new Error(data.error || 'Unable to open billing')
      window.location.href = data.url
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to open billing. Please try again.')
    }
  }

  async function cancel() {
    if (busy) return
    setBusy(true)
    try {
      const response = await fetch('/api/company/subscription/cancel', { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to cancel subscription. Please try again.')
      toast.success('Subscription canceled.')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to cancel subscription. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function submitRequest(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      const location = locationLabel.trim() ? { locationLabel: locationLabel.trim(), radiusMiles: radius } : undefined
      const response = await fetch('/api/company/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestDetails, location }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to submit request. Please try again.')
      setSubmittedId(data.request.id)
      setRequestDetails('')
      setLocationLabel('')
      setRadius(25)
      toast.success('Your advertisement request has been submitted.')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to submit request. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <div><h1 className="text-3xl font-bold">Company Dashboard</h1><p className="mt-1 text-muted-foreground">{company.name}</p></div>

      <section className="rounded-xl border p-5">
        <h2 className="font-semibold">Company Advertising Plan</h2>
        <p className="mt-1 text-sm text-muted-foreground">Your advertising subscription grants access to the advertisement-request functionality.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg bg-muted/40 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Current plan</p>
            <p className="mt-1 text-lg font-semibold">{company.subscription?.plan?.name || 'No plan'}</p>
            {company.subscription?.plan?.price !== undefined && company.subscription.plan.price !== null && (
              <p className="text-sm text-muted-foreground">{company.subscription.plan.price > 0 ? `$${(company.subscription.plan.price / 100).toFixed(2)} / ${company.subscription.plan.billingInterval || 'month'}` : 'Free'}</p>
            )}
          </div>
          <div className="rounded-lg bg-muted/40 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
            <p className="mt-1 text-lg font-semibold">{company.subscription?.isActive ? 'Active' : company.subscription?.status || 'Not subscribed'}</p>
            {company.subscription?.endDate && (
              <p className="text-sm text-muted-foreground">Renews / ends {new Date(company.subscription.endDate).toLocaleDateString()}</p>
            )}
            {company.subscription?.startDate && !company.subscription.endDate && (
              <p className="text-sm text-muted-foreground">Active since {new Date(company.subscription.startDate).toLocaleDateString()}</p>
            )}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={checkout} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">
            {company.subscription?.isActive ? 'Change plan' : 'Start advertising subscription'}
          </button>
          {company.subscription?.stripeCustomerId && (
            <button type="button" onClick={portal} disabled={busy} className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50">Billing portal</button>
          )}
          {company.subscription?.isActive && (
            <button type="button" onClick={cancel} disabled={busy} className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50">{busy ? 'Canceling…' : 'Cancel'}</button>
          )}
        </div>
      </section>

      <section className="rounded-xl border p-5">
        <h2 className="font-semibold">Request Advertisement</h2>
        <p className="mt-1 text-sm text-muted-foreground">Tell us what you want to advertise and where you want it to appear. An administrator will review your request and create the advertisement.</p>
        {submittedId ? (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm">
            <p className="font-semibold text-emerald-800">Your advertisement request has been submitted.</p>
            <p className="mt-1 text-emerald-700">An administrator will review your request and create the advertisement.</p>
            <p className="mt-2 text-xs text-emerald-700">Request ID: REQUEST-{submittedId.slice(-8).toUpperCase()} · Status: Requested</p>
          </div>
        ) : (
          <form onSubmit={submitRequest} className="mt-3 space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="ad-details">What would you like to advertise?</label>
              <textarea id="ad-details" value={requestDetails} onChange={(e) => setRequestDetails(e.target.value)} placeholder="Describe the advertisement you would like to request" className="min-h-24 w-full rounded-lg border bg-background p-3 text-sm" required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="ad-location">Where should your advertisement appear?</label>
                <input id="ad-location" value={locationLabel} onChange={(e) => setLocationLabel(e.target.value)} placeholder="City or area (e.g. Dallas, TX)" className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="ad-radius">Radius (miles)</label>
                <select id="ad-radius" value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-full rounded-lg border bg-background px-3 py-2 text-sm">
                  {[10, 25, 50, 100].map((r) => <option key={r} value={r}>{r} miles</option>)}
                </select>
              </div>
            </div>
            <button type="submit" disabled={busy} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {busy ? 'Submitting…' : 'Submit Advertisement Request'}
            </button>
          </form>
        )}
      </section>

      <section className="rounded-xl border p-5">
        <h2 className="font-semibold">My Advertisement Requests</h2>
        {requests.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">You have not submitted any advertisement requests yet.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {requests.map((item) => {
              const location = item.targetLocation && typeof item.targetLocation === 'object' ? item.targetLocation as Record<string, unknown> : {}
              return (
                <div key={item.id} className="rounded-lg border bg-muted/40 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">REQUEST-{item.id.slice(-8).toUpperCase()}</span>
                    <RequestStatusBadge status={item.status as never} />
                  </div>
                  <p className="mt-1 text-muted-foreground">{item.requestDetails}</p>
                  {formatRequestTargetLocation(location) !== '—' && (
                    <p className="mt-1 text-xs text-muted-foreground">Location: {formatRequestTargetLocation(location)}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">Submitted {new Date(item.createdAt).toLocaleDateString()}</p>
                  {item.advertisement && <p className="mt-1 text-xs font-medium text-emerald-700">Advertisement created: {item.advertisement.title}</p>}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}
