'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'

type Plan = {
  id: string
  name: string
  description: string | null
  price: number
  currency: string
  billingInterval: string
  stripeProductId: string | null
  stripePriceId: string | null
  features: string[]
  isActive: boolean
  displayOrder: number
  activeSubscribers?: number
  historicalSubscriptions?: number
  adRequests?: number
}

export default function CompanyAdvertisingPlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [plan, setPlan] = useState<Plan | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [featuresText, setFeaturesText] = useState('')

  useEffect(() => {
    let cancelled = false
    void params.then(({ id }) => {
      void fetch(`/api/admin/company-advertising-plans/${id}`).then(async (response) => {
        const data = await response.json()
        if (cancelled) return
        if (!response.ok || !data.plan) {
          setLoadError(data.error || 'Unable to load plan')
          return
        }
        // Price is stored in cents by the API; the UI edits it in USD so it
        // matches the create form and the price an admin actually sees.
        setPlan({ ...data.plan, price: data.plan.price / 100 })
        setFeaturesText((data.plan.features || []).join('\n'))
      }).catch(() => {
        if (!cancelled) setLoadError('Unable to load plan')
      })
    })
    return () => { cancelled = true }
  }, [params])

  const setField = (key: keyof Plan, value: string | boolean | number) => {
    if (!plan) return
    setPlan({ ...plan, [key]: value as never })
  }

  async function save() {
    if (saving || !plan) return
    setSaving(true)
    try {
      const response = await fetch(`/api/admin/company-advertising-plans/${plan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: plan.name,
          description: plan.description || '',
          price: Math.round(plan.price * 100),
          currency: plan.currency,
          billingInterval: plan.billingInterval,
          displayOrder: plan.displayOrder,
          isActive: plan.isActive,
          stripeProductId: plan.stripeProductId || '',
          stripePriceId: plan.stripePriceId || '',
          features: featuresText.split('\n').map((feature) => feature.trim()).filter(Boolean),
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to update plan')
      toast.success('Company advertising plan updated.')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update plan')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive() {
    if (saving || !plan) return
    setSaving(true)
    try {
      const response = await fetch(`/api/admin/company-advertising-plans/${plan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !plan.isActive }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to update plan')
      toast.success(plan.isActive ? 'Plan deactivated. Existing subscriptions remain active.' : 'Plan activated.')
      setPlan({ ...plan, isActive: !plan.isActive })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update plan')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (deleting || !plan) return
    setDeleting(true)
    try {
      const response = await fetch(`/api/admin/company-advertising-plans/${plan.id}`, { method: 'DELETE' })
      const data = await response.json()
      if (!response.ok) {
        toast.error(data.error || 'Unable to delete plan')
        return
      }
      toast.success('Company advertising plan deleted.')
      router.push('/admin/billing/company-advertising-plans')
    } catch {
      toast.error('Unable to delete plan')
    } finally {
      setDeleting(false)
    }
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Billing</p>
            <h1 className="text-3xl font-semibold tracking-tight">Company Advertising Plan</h1>
          </div>
          <Link href="/admin/billing/company-advertising-plans" className="rounded-lg border px-3 py-2 text-sm font-medium">Back</Link>
        </div>
        <div className="rounded-xl border bg-card p-6">
          <p className="text-sm text-destructive">{loadError}</p>
          <button
            type="button"
            onClick={() => { setLoadError(null); setPlan(null); window.location.reload() }}
            className="mt-4 rounded-lg border px-3 py-2 text-sm font-semibold"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!plan) return <div className="p-6 text-sm text-muted-foreground">Loading plan…</div>

  const subscriptionCount = plan.historicalSubscriptions ?? 0

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Billing</p>
          <h1 className="text-3xl font-semibold tracking-tight">{plan.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Company Advertising Plan</p>
        </div>
        <Link href="/admin/billing/company-advertising-plans" className="rounded-lg border px-3 py-2 text-sm font-medium">Back</Link>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Active subscribers" value={plan.activeSubscribers ?? 0} />
        <Stat label="Ad requests" value={plan.adRequests ?? 0} />
        <Stat label="Historical subscriptions" value={subscriptionCount} />
        <Stat label="Status" value={plan.isActive ? 'Active' : 'Inactive'} />
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold">Plan information</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1"><span className="text-sm font-medium">Name</span><input value={plan.name} onChange={(e) => setField('name', e.target.value)} className="w-full rounded-lg border bg-background px-3 py-2" /></label>
          <label className="block space-y-1"><span className="text-sm font-medium">Price (USD)</span><input type="number" min="0" step="0.01" value={plan.price} onChange={(e) => setField('price', Number(e.target.value))} className="w-full rounded-lg border bg-background px-3 py-2" /><span className="text-xs text-muted-foreground">Amount in US dollars. Saved as cents.</span></label>
          <label className="block space-y-1"><span className="text-sm font-medium">Currency</span><select value={plan.currency} onChange={(e) => setField('currency', e.target.value)} className="w-full rounded-lg border bg-background px-3 py-2"><option value="usd">USD</option><option value="eur">EUR</option><option value="gbp">GBP</option></select></label>
          <label className="block space-y-1"><span className="text-sm font-medium">Billing interval</span><select value={plan.billingInterval} onChange={(e) => setField('billingInterval', e.target.value)} className="w-full rounded-lg border bg-background px-3 py-2"><option value="month">month</option><option value="year">year</option><option value="week">week</option><option value="day">day</option></select></label>
          <label className="block space-y-1"><span className="text-sm font-medium">Display order</span><input type="number" min="0" value={plan.displayOrder} onChange={(e) => setField('displayOrder', Number(e.target.value))} className="w-full rounded-lg border bg-background px-3 py-2" /></label>
          <label className="block space-y-1"><span className="text-sm font-medium">Description</span><textarea value={plan.description || ''} onChange={(e) => setField('description', e.target.value)} className="min-h-16 w-full rounded-lg border bg-background px-3 py-2" /></label>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Status</span>
          <span className={plan.isActive ? 'rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600' : 'rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground'}>{plan.isActive ? 'Active' : 'Inactive'}</span>
          <button type="button" onClick={toggleActive} className="ml-auto rounded-lg border px-3 py-1.5 text-xs font-semibold">{plan.isActive ? 'Deactivate' : 'Activate'}</button>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold">Features</h2>
        <textarea value={featuresText} onChange={(e) => setFeaturesText(e.target.value)} placeholder="One feature per line" className="min-h-16 w-full rounded-lg border bg-background px-3 py-2" />
        <p className="text-xs text-muted-foreground">Feature strings describe plan capabilities and are future-ready. They do not yet enforce advertisement limits.</p>
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold">Stripe</h2>
        <label className="block space-y-1"><span className="text-sm font-medium">Product ID</span><input value={plan.stripeProductId || ''} onChange={(e) => setField('stripeProductId', e.target.value)} className="w-full rounded-lg border bg-background px-3 py-2" placeholder="prod_..." /></label>
        <label className="block space-y-1"><span className="text-sm font-medium">Price ID</span><input value={plan.stripePriceId || ''} onChange={(e) => setField('stripePriceId', e.target.value)} className="w-full rounded-lg border bg-background px-3 py-2" placeholder="price_..." /></label>
        <p className="text-xs text-muted-foreground">Stripe identifiers are validated against the Stripe API when saved. Secret keys are never exposed. Changing Stripe mapping on a plan with active subscriptions is blocked to protect active billing.</p>
      </section>

      <div className="flex items-center gap-2">
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {saving ? 'Saving...' : 'Save plan'}
        </button>
        <button onClick={remove} disabled={deleting || subscriptionCount > 0} className="ml-auto inline-flex items-center gap-2 rounded-lg border border-destructive px-4 py-2 text-sm font-semibold text-destructive disabled:opacity-50">
          {deleting ? 'Deleting…' : 'Delete'}
        </button>
      </div>
      {subscriptionCount > 0 && (
        <p className="text-xs text-muted-foreground">This plan has {subscriptionCount} subscription{subscriptionCount === 1 ? '' : 's'}. Deactivate it instead of deleting.</p>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  )
}