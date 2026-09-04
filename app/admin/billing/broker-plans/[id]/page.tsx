'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Switch } from '@/components/ui/switch'

// Stable client-only identity for features that have not been persisted yet.
// It is never sent to the server as a database id (the API treats a row without
// a DB id as a new feature). Prefixing makes it unambiguous and collision-free.
let clientFeatureSeq = 0
function newClientFeatureId(): string {
  clientFeatureSeq += 1
  const rand = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10)
  return `new-${clientFeatureSeq}-${rand}`
}

type PlanFeature = { id: string; label: string; enabled: boolean; sortOrder: number }

type Plan = {
  id: string
  name: string
  displayName?: string
  code: string
  description: string | null
  price: number
  billingInterval: string
  currency: string
  stripeProductId: string | null
  stripePriceId: string | null
  isActive: boolean
  displayOrder: number
  features: PlanFeature[]
  _count?: { subscriptions: number }
}

export default function BrokerPlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [plan, setPlan] = useState<Plan | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [newFeature, setNewFeature] = useState('')
  const [featureError, setFeatureError] = useState<string | null>(null)

  async function fetchPlan(planId: string) {
    const response = await fetch(`/api/admin/broker-plans/${planId}`)
    const data = await response.json().catch(() => null)
    if (!response.ok) {
      throw new Error(data?.message || `Unable to load plan (${response.status})`)
    }
    if (!data?.plan) {
      throw new Error('Unable to load plan: unexpected response')
    }
    setPlan({ ...data.plan, price: data.plan.price / 100 })
  }

  useEffect(() => {
    let cancelled = false
    void params.then(({ id: planId }) => {
      fetchPlan(planId).catch((error) => {
        if (cancelled) return
        setLoadError(error instanceof Error ? error.message : 'Unable to load plan')
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
    const planId = plan.id
    // Validate every feature label before persisting. Both persisted and newly
    // added rows must have a trimmed, non-empty label of 120 chars or fewer.
    // Duplicate labels on the same plan are rejected (matches the add-feature
    // policy). Invalid input is surfaced and save is aborted — no silent loss.
    const trimmedFeatures = plan.features.map((f) => ({ ...f, label: f.label.trim() }))
    for (const f of trimmedFeatures) {
      if (!f.label) {
        setSaving(false)
        toast.error('Every feature needs a non-empty display label.')
        return
      }
      if (f.label.length > 120) {
        setSaving(false)
        toast.error(`Feature label must be 120 characters or fewer: "${f.label}".`)
        return
      }
    }
    const seenLabels = new Set<string>()
    for (const f of trimmedFeatures) {
      if (seenLabels.has(f.label)) {
        setSaving(false)
        toast.error(`Duplicate feature label on this plan: "${f.label}".`)
        return
      }
      seenLabels.add(f.label)
    }
    setSaving(true)
    try {
      const response = await fetch(`/api/admin/broker-plans/${planId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: plan.description || '',
          price: Math.round(plan.price * 100),
          billingInterval: plan.billingInterval,
          currency: plan.currency,
          displayOrder: plan.displayOrder,
          isActive: plan.isActive,
          stripeProductId: plan.stripeProductId || '',
          stripePriceId: plan.stripePriceId || '',
          // Persisted features carry their DB id; newly added features carry a
          // client-only temporary id (starts with "new-") which must be omitted
          // so the API treats them as rows to create rather than foreign ones.
          features: trimmedFeatures.map((f) => {
            const isPersisted = f.id && !f.id.startsWith('new-')
            return {
              ...(isPersisted ? { id: f.id } : {}),
              label: f.label,
              enabled: f.enabled,
              sortOrder: f.sortOrder,
            }
          }),
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to update plan')
      toast.success('Broker plan updated.')
      await fetchPlan(planId)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update plan')
    } finally {
      setSaving(false)
    }
  }

  function toggleFeature(featureId: string, enabled: boolean) {
    if (!plan) return
    setPlan({
      ...plan,
      features: plan.features.map((f) => (f.id === featureId ? { ...f, enabled } : f)),
    })
  }

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

  const features = [...plan.features].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

  const updateFeature = (featureId: string, patch: Partial<Pick<PlanFeature, 'label' | 'enabled' | 'sortOrder'>>) => {
    if (!plan) return
    setPlan({
      ...plan,
      features: plan.features.map((f) => (f.id === featureId ? { ...f, ...patch } : f)),
    })
  }

  function addFeature() {
    if (!plan) return
    const label = newFeature.trim()
    if (!label) {
      setFeatureError('Enter a feature label.')
      return
    }
    if (label.length > 120) {
      setFeatureError('Feature label must be 120 characters or fewer.')
      return
    }
    if (plan.features.some((f) => f.label === label)) {
      setFeatureError(`A feature with label "${label}" already exists on this plan.`)
      return
    }
    setPlan({
      ...plan,
      features: [...plan.features, { id: newClientFeatureId(), label, enabled: true, sortOrder: Math.max(0, ...plan.features.map((f) => f.sortOrder ?? 0)) + 10 }],
    })
    setNewFeature('')
    setFeatureError(null)
  }

  function removeFeature(featureId: string) {
    if (!plan) return
    setPlan({ ...plan, features: plan.features.filter((f) => f.id !== featureId) })
  }


  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Billing</p>
          <h1 className="text-3xl font-semibold tracking-tight">{plan.displayName || plan.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{plan.code}</p>
        </div>
        <Link href="/admin/billing/broker-plans" className="rounded-lg border px-3 py-2 text-sm font-medium">Back</Link>
      </div>

      <section className="space-y-4 rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold">Plan information</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1"><span className="text-sm font-medium">Plan</span><div className="flex h-9 items-center rounded-lg border bg-muted/40 px-3 text-sm text-foreground">{plan.displayName || plan.name}</div></label>
          <label className="block space-y-1"><span className="text-sm font-medium">Code</span><div className="flex h-9 items-center rounded-lg border bg-muted/40 px-3 text-sm text-muted-foreground">{plan.code}</div></label>
          <p className="text-xs text-muted-foreground sm:col-span-2">Plan identity and customer-facing name are fixed and cannot be changed.</p>
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
        <p className="text-xs text-muted-foreground">Each feature line appears to customers on plan cards. Toggle availability, edit the display label, set the display order, add custom features, or remove features. Changes save when you click &quot;Save plan&quot;.</p>

        <div className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
          <label className="block min-w-52 flex-1 space-y-1">
            <span className="text-xs text-muted-foreground">New feature label</span>
            <input value={newFeature} onChange={(e) => setNewFeature(e.target.value)} placeholder="e.g. Priority Search Visibility" maxLength={120} className="w-full rounded-lg border bg-background px-3 py-2" />
          </label>
          <button type="button" onClick={addFeature} disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Add feature</button>
        </div>
        {featureError && <p className="text-xs font-medium text-destructive">{featureError}</p>}

        {features.length === 0 && (
          <p className="text-xs text-muted-foreground">No features yet. Add a feature above.</p>
        )}
        {features.map((feature, index) => (
          <div key={feature.id} className="flex items-start justify-between gap-4 rounded-lg border px-4 py-3">
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">Feature #{index + 1}</span>
                <button type="button" onClick={() => removeFeature(feature.id)} disabled={saving} aria-label={`Remove feature ${index + 1}`} className="rounded-md border border-destructive/40 px-2 py-0.5 text-xs font-medium text-destructive hover:bg-destructive/10">Remove</button>
              </div>
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">Display label</span>
                <input value={feature.label} onChange={(e) => updateFeature(feature.id, { label: e.target.value })} placeholder="e.g. Appear in Search Results" className="w-full rounded-lg border bg-background px-3 py-2" maxLength={120} />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">Display order</span>
                <input type="number" min="0" value={feature.sortOrder ?? 0} onChange={(e) => updateFeature(feature.id, { sortOrder: Number(e.target.value) })} className="w-full max-w-40 rounded-lg border bg-background px-3 py-2" />
              </label>
            </div>
            <Switch
              checked={feature.enabled}
              disabled={saving}
              onCheckedChange={(checked) => toggleFeature(feature.id, checked)}
              aria-label={`Feature ${index + 1} ${feature.enabled ? 'enabled' : 'disabled'}`}
            />
          </div>
        ))}
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
