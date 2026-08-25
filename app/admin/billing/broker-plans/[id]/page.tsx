'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { BROKER_FEATURE_DEFS } from '@/lib/broker-plan-features'

type Plan = {
  id: string
  name: string
  code: string
  description: string | null
  price: number
  billingInterval: string
  currency: string
  stripeProductId: string | null
  stripePriceId: string | null
  isActive: boolean
  displayOrder: number
  features: { code: string; enabled: boolean }[]
  _count?: { subscriptions: number }
}

export default function BrokerPlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [plan, setPlan] = useState<Plan | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let cancelled = false
    void params.then(({ id: planId }) => {
      void fetch(`/api/admin/broker-plans/${planId}`).then(async (response) => {
        const data = await response.json()
        if (cancelled) return
        if (!response.ok || !data.plan) {
          setLoadError(data.message || 'Unable to load plan')
          return
        }
        // Price is stored in cents by the API; the UI edits it in USD so it
        // matches the create form and the price an admin actually sees.
        setPlan({ ...data.plan, price: data.plan.price / 100 })
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
      const response = await fetch(`/api/admin/broker-plans/${plan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: plan.name,
          code: plan.code,
          description: plan.description || '',
          price: Math.round(plan.price * 100),
          billingInterval: plan.billingInterval,
          currency: plan.currency,
          displayOrder: plan.displayOrder,
          isActive: plan.isActive,
          stripeProductId: plan.stripeProductId || '',
          stripePriceId: plan.stripePriceId || '',
          feature_PROFILE_BADGE: plan.features?.some((feature) => feature.code === 'PROFILE_BADGE' && feature.enabled) ?? false,
          feature_SUPPORT_TICKETS: plan.features?.some((feature) => feature.code === 'SUPPORT_TICKETS' && feature.enabled) ?? false,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to update plan')
      toast.success('Broker plan updated.')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update plan')
    } finally {
      setSaving(false)
    }
  }

  async function toggleFeature(code: string, enabled: boolean) {
    if (!plan) return
    setPlan({
      ...plan,
      features: plan.features.some((feature) => feature.code === code)
        ? plan.features.map((feature) => feature.code === code ? { ...feature, enabled } : feature)
        : [...plan.features, { code, enabled }],
    })
    await save()
  }

  const isFeatureEnabled = useCallback((code: string) => {
    return plan?.features?.some((feature) => feature.code === code && feature.enabled) ?? false
  }, [plan])

  async function deactivate() {
    if (saving || !plan) return
    setSaving(true)
    try {
      const response = await fetch(`/api/admin/broker-plans/${plan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !plan.isActive }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to update plan')
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
      const response = await fetch(`/api/admin/broker-plans/${plan.id}`, { method: 'DELETE' })
      const data = await response.json()
      if (!response.ok) {
        toast.error(data.message || 'Unable to delete plan')
        return
      }
      toast.success('Broker plan deleted.')
      router.push('/admin/billing/broker-plans')
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
            <h1 className="text-3xl font-semibold tracking-tight">Broker Plan</h1>
          </div>
          <Link href="/admin/billing/broker-plans" className="rounded-lg border px-3 py-2 text-sm font-medium">Back</Link>
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

  if (!plan) {
    return <div className="p-6 text-sm text-muted-foreground">Loading plan…</div>
  }

  const subscriberCount = plan._count?.subscriptions ?? 0

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Billing</p>
          <h1 className="text-3xl font-semibold tracking-tight">{plan.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{plan.code}</p>
        </div>
        <Link href="/admin/billing/broker-plans" className="rounded-lg border px-3 py-2 text-sm font-medium">Back</Link>
      </div>

      <section className="space-y-4 rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold">Plan information</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1"><span className="text-sm font-medium">Name</span><input maxLength={100} value={plan.name} onChange={(e) => setField('name', e.target.value)} className="w-full rounded-lg border bg-background px-3 py-2" /></label>
          <label className="block space-y-1"><span className="text-sm font-medium">Code</span><input maxLength={50} value={plan.code} onChange={(e) => setField('code', e.target.value)} className="w-full rounded-lg border bg-background px-3 py-2" /></label>
          <label className="block space-y-1 sm:col-span-2"><span className="text-sm font-medium">Description</span><textarea value={plan.description || ''} onChange={(e) => setField('description', e.target.value)} className="min-h-16 w-full rounded-lg border bg-background px-3 py-2" /></label>
          <label className="block space-y-1"><span className="text-sm font-medium">Price (USD)</span><input type="number" min="0" step="0.01" value={plan.price} onChange={(e) => setField('price', Number(e.target.value))} className="w-full rounded-lg border bg-background px-3 py-2" /><span className="text-xs text-muted-foreground">Amount in US dollars. Saved as cents.</span></label>
          <label className="block space-y-1"><span className="text-sm font-medium">Currency</span><select value={plan.currency} onChange={(e) => setField('currency', e.target.value)} className="w-full rounded-lg border bg-background px-3 py-2"><option value="usd">USD</option><option value="eur">EUR</option><option value="gbp">GBP</option></select></label>
          <label className="block space-y-1"><span className="text-sm font-medium">Billing interval</span><select value={plan.billingInterval} onChange={(e) => setField('billingInterval', e.target.value)} className="w-full rounded-lg border bg-background px-3 py-2"><option value="month">month</option><option value="year">year</option><option value="week">week</option><option value="day">day</option></select></label>
          <label className="block space-y-1"><span className="text-sm font-medium">Display order</span><input type="number" min="0" value={plan.displayOrder} onChange={(e) => setField('displayOrder', Number(e.target.value))} className="w-full rounded-lg border bg-background px-3 py-2" /></label>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Status</span>
          <span className={plan.isActive ? 'rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600' : 'rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground'}>{plan.isActive ? 'Active' : 'Inactive'}</span>
          <button type="button" onClick={deactivate} className="ml-auto rounded-lg border px-3 py-1.5 text-xs font-semibold">{plan.isActive ? 'Deactivate' : 'Activate'}</button>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold">Features</h2>
        <p className="text-xs text-muted-foreground">Each feature is an entitlement that changes what subscribers receive. Toggling a feature saves immediately.</p>
        {BROKER_FEATURE_DEFS.map((feature) => {
          const enabled = isFeatureEnabled(feature.code)
          return (
            <div key={feature.code} className="flex items-start justify-between gap-4 rounded-lg border px-4 py-3">
              <div>
                <span className="text-sm font-medium">{feature.label}</span>
                <p className="mt-0.5 text-xs text-muted-foreground">{feature.description}</p>
              </div>
              <Switch
                checked={enabled}
                disabled={saving}
                onCheckedChange={(checked) => void toggleFeature(feature.code, checked)}
                aria-label={`${feature.label} ${enabled ? 'enabled' : 'disabled'}`}
              />
            </div>
          )
        })}
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold">Stripe</h2>
        <label className="block space-y-1"><span className="text-sm font-medium">Product ID</span><input value={plan.stripeProductId || ''} onChange={(e) => setField('stripeProductId', e.target.value)} className="w-full rounded-lg border bg-background px-3 py-2" placeholder="prod_..." /></label>
        <label className="block space-y-1"><span className="text-sm font-medium">Price ID</span><input value={plan.stripePriceId || ''} onChange={(e) => setField('stripePriceId', e.target.value)} className="w-full rounded-lg border bg-background px-3 py-2" placeholder="price_..." /></label>
        <p className="text-xs text-muted-foreground">Stripe identifiers are validated against the Stripe API when saved. Secret keys are never exposed.</p>
      </section>

      <div className="flex items-center gap-2">
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {saving ? 'Saving...' : 'Save plan'}
        </button>
        <button onClick={remove} disabled={deleting || subscriberCount > 0} className="ml-auto inline-flex items-center gap-2 rounded-lg border border-destructive px-4 py-2 text-sm font-semibold text-destructive disabled:opacity-50">
          {deleting ? 'Deleting…' : 'Delete'}
        </button>
      </div>
      {subscriberCount > 0 && (
        <p className="text-xs text-muted-foreground">This plan has {subscriberCount} subscription{subscriberCount === 1 ? '' : 's'}. Deactivate it instead of deleting.</p>
      )}
    </div>
  )
}