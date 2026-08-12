'use client'

import { useState } from 'react'

type CompanyDashboardData = {
  id: string
  name: string
  address: string
  contactName: string
  contactPosition: string
  phone: string
  subscription: { status: string; isActive: boolean; stripeCustomerId: string | null } | null
}

type CompanyRequest = { id: string; status: string; requestDetails: string | null }

export function CompanyDashboardClient({ company, requests }: { company: CompanyDashboardData; requests: CompanyRequest[] }) {
  const [requestDetails, setRequestDetails] = useState('')
  const [message, setMessage] = useState('')
  async function checkout() {
    const response = await fetch('/api/company/subscription/checkout', { method: 'POST' })
    const data = await response.json()
    if (data.url) window.location.href = data.url
    else setMessage(data.error || 'Unable to start subscription')
  }
  async function portal() {
    const response = await fetch('/api/company/subscription/portal', { method: 'POST' })
    const data = await response.json()
    if (data.url) window.location.href = data.url
    else setMessage(data.error || 'Unable to open billing')
  }
  async function cancel() {
    const response = await fetch('/api/company/subscription/cancel', { method: 'POST' })
    const data = await response.json()
    setMessage(response.ok ? 'Subscription canceled.' : data.error || 'Unable to cancel subscription')
  }
  async function submitRequest(event: React.FormEvent) {
    event.preventDefault()
    const response = await fetch('/api/company/requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestDetails }) })
    const data = await response.json()
    setMessage(response.ok ? 'Advertising request submitted.' : data.error || 'Unable to submit request')
    if (response.ok) setRequestDetails('')
  }
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <div><h1 className="text-3xl font-bold">Company Dashboard</h1><p className="mt-1 text-muted-foreground">{company.name}</p></div>
      <section className="rounded-xl border p-5"><h2 className="font-semibold">Company Profile</h2><p className="mt-2 text-sm text-muted-foreground">{company.address}</p><p className="text-sm text-muted-foreground">{company.contactName}, {company.contactPosition} · {company.phone}</p></section>
      <section className="rounded-xl border p-5"><h2 className="font-semibold">Subscription & Billing</h2><p className="mt-2 text-sm text-muted-foreground">Status: {company.subscription?.status || 'Not subscribed'}</p><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={checkout} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">{company.subscription?.isActive ? 'Subscription active' : 'Start advertising subscription'}</button>{company.subscription?.stripeCustomerId && <button type="button" onClick={portal} className="rounded-lg border px-4 py-2 text-sm font-semibold">Billing portal</button>}{company.subscription?.isActive && <button type="button" onClick={cancel} className="rounded-lg border px-4 py-2 text-sm font-semibold">Cancel</button>}</div><p className="mt-2 text-xs text-muted-foreground">Monthly, cancel anytime. Eligible Stripe promotion codes can be applied during checkout.</p></section>
      <section className="rounded-xl border p-5"><h2 className="font-semibold">Advertisement Request</h2><form onSubmit={submitRequest} className="mt-3 space-y-3"><textarea value={requestDetails} onChange={(event) => setRequestDetails(event.target.value)} placeholder="Describe the advertisement you would like to request" className="min-h-28 w-full rounded-lg border bg-background p-3 text-sm" required /><button type="submit" className="rounded-lg border px-4 py-2 text-sm font-semibold">Submit request</button></form><div className="mt-4 space-y-2">{requests.map((item) => <div key={item.id} className="rounded-lg bg-muted p-3 text-sm"><span className="font-medium">{item.status}</span><p className="mt-1 text-muted-foreground">{item.requestDetails}</p></div>)}</div></section>
      {message && <p className="rounded-lg bg-primary/10 p-3 text-sm">{message}</p>}
    </main>
  )
}
