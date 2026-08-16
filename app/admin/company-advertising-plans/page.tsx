'use client'
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from 'react'

type CompanyAdvertisingPlan = {
  id: string
  name: string
  description: string | null
  price: number
  billingInterval: string
  stripeProductId: string | null
  stripePriceId: string | null
  features: string[]
  isActive: boolean
}

export default function CompanyAdvertisingPlansAdminPage() {
  const [plans, setPlans] = useState<CompanyAdvertisingPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState<Record<string, string>>({ name: '', description: '', price: '0', billingInterval: 'month', stripeProductId: '', stripePriceId: '', features: '' })

  async function load() {
    const response = await fetch('/api/admin/company-advertising-plans')
    const data = await response.json()
    if (response.ok) setPlans(data.plans || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const set = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }))

  async function create(event: React.FormEvent) {
    event.preventDefault()
    const response = await fetch('/api/admin/company-advertising-plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        description: form.description,
        price: Number(form.price),
        billingInterval: form.billingInterval,
        stripeProductId: form.stripeProductId,
        stripePriceId: form.stripePriceId,
        features: form.features.split('\n').map((f) => f.trim()).filter(Boolean),
      }),
    })
    const data = await response.json()
    setMessage(response.ok ? 'Plan created.' : data.error || 'Unable to create plan')
    if (response.ok) { setForm({ name: '', description: '', price: '0', billingInterval: 'month', stripeProductId: '', stripePriceId: '', features: '' }); await load() }
  }

  async function toggle(plan: CompanyAdvertisingPlan) {
    const response = await fetch('/api/admin/company-advertising-plans', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: plan.id, isActive: !plan.isActive }),
    })
    const data = await response.json()
    setMessage(response.ok ? 'Plan updated.' : data.error || 'Unable to update plan')
    if (response.ok) await load()
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <h1 className="text-2xl font-bold">Company Advertising Plans</h1>
      <section className="rounded-xl border p-5">
        <h2 className="font-semibold">Create plan</h2>
        <form onSubmit={create} className="mt-3 grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Name" value={form.name} onChange={(e) => set('name', e.target.value)} required />
            <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Price (cents)" type="number" value={form.price} onChange={(e) => set('price', e.target.value)} required />
            <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Billing interval" value={form.billingInterval} onChange={(e) => set('billingInterval', e.target.value)} required />
            <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Stripe product ID" value={form.stripeProductId} onChange={(e) => set('stripeProductId', e.target.value)} />
            <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Stripe price ID" value={form.stripePriceId} onChange={(e) => set('stripePriceId', e.target.value)} />
          </div>
          <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Description" value={form.description} onChange={(e) => set('description', e.target.value)} />
          <textarea className="rounded-lg border px-3 py-2 text-sm" placeholder="Features (one per line)" value={form.features} onChange={(e) => set('features', e.target.value)} />
          <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">Create plan</button>
        </form>
      </section>
      <section className="rounded-xl border p-5">
        <h2 className="font-semibold">Plans</h2>
        {loading ? <p className="mt-2 text-sm text-muted-foreground">Loading…</p> : (
          <div className="mt-3 space-y-3">
            {plans.map((plan) => (
              <div key={plan.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted p-3 text-sm">
                <div>
                  <span className="font-medium">{plan.name}</span>
                  <span className="ml-2 text-muted-foreground">${(plan.price / 100).toFixed(2)}/{plan.billingInterval}</span>
                  {plan.stripePriceId && <span className="ml-2 text-xs text-muted-foreground">{plan.stripePriceId}</span>}
                </div>
                <button type="button" onClick={() => toggle(plan)} className="rounded-lg border px-3 py-1 text-xs font-semibold">{plan.isActive ? 'Deactivate' : 'Activate'}</button>
              </div>
            ))}
          </div>
        )}
      </section>
      {message && <p className="rounded-lg bg-primary/10 p-3 text-sm">{message}</p>}
    </main>
  )
}
