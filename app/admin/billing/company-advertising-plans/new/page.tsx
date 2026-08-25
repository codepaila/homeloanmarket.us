'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'

export default function NewCompanyAdvertisingPlanPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '0',
    currency: 'usd',
    billingInterval: 'month',
    displayOrder: '0',
    isActive: true,
    stripeProductId: '',
    stripePriceId: '',
    features: '',
  })

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      const response = await fetch('/api/admin/company-advertising-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          price: Math.round(Number(form.price) * 100),
          currency: form.currency,
          billingInterval: form.billingInterval,
          displayOrder: Number(form.displayOrder),
          isActive: form.isActive,
          stripeProductId: form.stripeProductId,
          stripePriceId: form.stripePriceId,
          features: form.features.split('\n').map((feature) => feature.trim()).filter(Boolean),
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to create plan')
      toast.success('Company advertising plan created.')
      router.push('/admin/billing/company-advertising-plans')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to create plan')
    } finally {
      setSaving(false)
    }
  }

  const set = (key: string, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }))

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Billing</p>
          <h1 className="text-3xl font-semibold tracking-tight">Create Company Advertising Plan</h1>
        </div>
        <Link href="/admin/billing/company-advertising-plans" className="rounded-lg border px-3 py-2 text-sm font-medium">Back</Link>
      </div>

      <form onSubmit={submit} className="space-y-6 rounded-xl border bg-card p-6">
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Plan information</h2>
          <Field label="Name" value={form.name} onChange={(v) => set('name', v)} placeholder="Standard Advertising" required maxLength={100} />
          <label className="block space-y-1"><span className="text-sm font-medium">Description</span><textarea value={form.description} onChange={(e) => set('description', e.target.value)} className="min-h-20 w-full rounded-lg border bg-background px-3 py-2" /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Price (USD)" value={form.price} onChange={(v) => set('price', v)} type="number" min="0" step="0.01" hint="Amount in US dollars. Saved as cents." />
            <Field label="Display order" value={form.displayOrder} onChange={(v) => set('displayOrder', v)} type="number" min="0" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1"><span className="text-sm font-medium">Currency</span><select value={form.currency} onChange={(e) => set('currency', e.target.value)} className="w-full rounded-lg border bg-background px-3 py-2"><option value="usd">USD</option><option value="eur">EUR</option><option value="gbp">GBP</option></select></label>
            <label className="block space-y-1"><span className="text-sm font-medium">Billing interval</span><select value={form.billingInterval} onChange={(e) => set('billingInterval', e.target.value)} className="w-full rounded-lg border bg-background px-3 py-2"><option value="month">month</option><option value="year">year</option><option value="week">week</option><option value="day">day</option></select></label>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} /> Active</label>
        </section>

        <section className="space-y-3 border-t pt-4">
          <h2 className="text-lg font-semibold">Features</h2>
          <p className="text-xs text-muted-foreground">One feature per line. These describe the plan&apos;s capabilities and are future-ready.</p>
          <textarea value={form.features} onChange={(e) => set('features', e.target.value)} placeholder="Priority placement&#10;Dedicated support" className="min-h-16 w-full rounded-lg border bg-background px-3 py-2" />
        </section>

        <section className="space-y-4 border-t pt-4">
          <h2 className="text-lg font-semibold">Stripe</h2>
          <p className="text-xs text-muted-foreground">FREE plans do not require Stripe identifiers. Paid plans must reference valid, matching Stripe Product and Price IDs.</p>
          <Field label="Stripe Product ID" value={form.stripeProductId} onChange={(v) => set('stripeProductId', v)} placeholder="prod_..." />
          <Field label="Stripe Price ID" value={form.stripePriceId} onChange={(v) => set('stripePriceId', v)} placeholder="price_..." />
        </section>

        <button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {saving ? 'Saving...' : 'Create plan'}
        </button>
      </form>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text', min, step, maxLength, hint, required }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; min?: string; step?: string; maxLength?: number; hint?: string; required?: boolean }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      <input type={type} min={min} step={step} maxLength={maxLength} required={required} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-lg border bg-background px-3 py-2" />
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  )
}