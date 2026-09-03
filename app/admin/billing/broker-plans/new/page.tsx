'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Switch } from '@/components/ui/switch'

type FeatureDraft = { label: string; enabled: boolean; sortOrder: number }

type SupportedPlanChoice = { code: string; displayName: string; exists: boolean }

export default function NewBrokerPlanPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [loadingPlans, setLoadingPlans] = useState(true)
  const [plansError, setPlansError] = useState<string | null>(null)
  const [supportedPlans, setSupportedPlans] = useState<SupportedPlanChoice[]>([])
  const [planCode, setPlanCode] = useState('')
  const [form, setForm] = useState({
    description: '',
    price: '0',
    billingInterval: 'month',
    currency: 'usd',
    displayOrder: '0',
    isActive: true,
    stripeProductId: '',
    stripePriceId: '',
  })
  const [features, setFeatures] = useState<FeatureDraft[]>([])
  const [newFeature, setNewFeature] = useState('')
  const [featureError, setFeatureError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/broker-plans')
      .then(async (response) => {
        const data = await response.json()
        if (cancelled) return
        if (!response.ok) {
          setPlansError(data.message || 'Unable to load plan options')
          return
        }
        setSupportedPlans(data.supportedPlans || [])
        const available = (data.supportedPlans || []).filter((p: SupportedPlanChoice) => !p.exists)
        if (available.length > 0) setPlanCode(available[0].code)
      })
      .catch(() => {
        if (!cancelled) setPlansError('Unable to load plan options')
      })
      .finally(() => {
        if (!cancelled) setLoadingPlans(false)
      })
    return () => { cancelled = true }
  }, [])

  const availableChoices = useMemo(() => supportedPlans.filter((p) => !p.exists), [supportedPlans])
  const createdChoices = useMemo(() => supportedPlans.filter((p) => p.exists), [supportedPlans])
  const selected = supportedPlans.find((p) => p.code === planCode)

  function addFeature() {
    const label = newFeature.trim()
    if (!label) {
      setFeatureError('Enter a feature label.')
      return
    }
    if (label.length > 120) {
      setFeatureError('Feature label must be 120 characters or fewer.')
      return
    }
    if (features.some((f) => f.label === label)) {
      setFeatureError(`A feature with label "${label}" already exists on this plan.`)
      return
    }
    const nextOrder = Math.max(0, ...features.map((f) => f.sortOrder)) + 10
    setFeatures([...features, { label, enabled: true, sortOrder: nextOrder }])
    setNewFeature('')
    setFeatureError(null)
  }

  function removeFeature(index: number) {
    setFeatures((cur) => cur.filter((_, i) => i !== index))
  }

  function updateFeature(index: number, patch: Partial<FeatureDraft>) {
    setFeatures((cur) => cur.map((f, i) => (i === index ? { ...f, ...patch } : f)))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (saving) return
    if (!planCode || !selected || selected.exists) {
      toast.error('Select an available plan to create.')
      return
    }
    setSaving(true)
    try {
      const response = await fetch('/api/admin/broker-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: planCode,
          ...form,
          price: Math.round(Number(form.price) * 100),
          displayOrder: Number(form.displayOrder),
          features,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to create plan')
      toast.success('Broker plan created.')
      router.push('/admin/billing/broker-plans')
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
          <h1 className="text-3xl font-semibold tracking-tight">Create Broker Plan</h1>
        </div>
        <Link href="/admin/billing/broker-plans" className="rounded-lg border px-3 py-2 text-sm font-medium">Back</Link>
      </div>

      {loadingPlans ? (
        <div className="flex items-center gap-2 rounded-xl border bg-card p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading available plans…
        </div>
      ) : plansError ? (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-sm">
          <p className="font-medium text-destructive">Unable to load plan options</p>
          <p className="mt-1 text-xs text-muted-foreground">{plansError}</p>
        </div>
      ) : availableChoices.length === 0 ? (
        <div className="space-y-4 rounded-xl border bg-card p-6">
          <p className="text-sm text-muted-foreground">
            All supported broker plans are already configured. You can manage them from the plans list.
          </p>
          <Link href="/admin/billing/broker-plans" className="inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            Manage plans
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-6 rounded-xl border bg-card p-6">
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Plan information</h2>
            <div className="space-y-3">
              <label className="block space-y-1">
                <span className="text-sm font-medium">Plan</span>
                <select
                  value={planCode}
                  onChange={(e) => setPlanCode(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2"
                  aria-label="Select a fixed plan to create"
                >
                  {availableChoices.map((choice) => (
                    <option key={choice.code} value={choice.code}>{choice.displayName}</option>
                  ))}
                </select>
              </label>
              {selected && <p className="text-xs text-muted-foreground">Customer-facing name: <span className="font-medium text-foreground">{selected.displayName}</span></p>}
            </div>

            {createdChoices.length > 0 && (
              <div className="space-y-1.5 rounded-lg border bg-muted/40 p-3">
                <p className="text-xs font-medium text-muted-foreground">Already configured</p>
                {createdChoices.map((choice) => (
                  <div key={choice.code} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{choice.displayName}</span>
                    <span className="text-xs text-muted-foreground">Available</span>
                  </div>
                ))}
              </div>
            )}

            <label className="block space-y-1"><span className="text-sm font-medium">Description</span><textarea value={form.description} onChange={(e) => set('description', e.target.value)} className="min-h-20 w-full rounded-lg border bg-background px-3 py-2" /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Price (USD)" value={form.price} onChange={(v) => set('price', v)} type="number" min="0" step="0.01" hint="Amount in US dollars. Saved as cents." />
              <Field label="Display order" value={form.displayOrder} onChange={(v) => set('displayOrder', v)} type="number" min="0" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1"><span className="text-sm font-medium">Billing interval</span><select value={form.billingInterval} onChange={(e) => set('billingInterval', e.target.value)} className="w-full rounded-lg border bg-background px-3 py-2"><option value="month">month</option><option value="year">year</option><option value="week">week</option><option value="day">day</option></select></label>
              <label className="block space-y-1"><span className="text-sm font-medium">Currency</span><select value={form.currency} onChange={(e) => set('currency', e.target.value)} className="w-full rounded-lg border bg-background px-3 py-2"><option value="usd">USD</option><option value="eur">EUR</option><option value="gbp">GBP</option></select></label>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} /> Active</label>
          </section>

          <section className="space-y-3 border-t pt-4">
            <h2 className="text-lg font-semibold">Features</h2>
            <p className="text-xs text-muted-foreground">Each feature line appears to customers on plan cards. Toggle availability, edit the display label, set the display order, add custom features, or remove features.</p>

            <div className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
              <label className="block min-w-52 flex-1 space-y-1">
                <span className="text-xs text-muted-foreground">New feature label</span>
                <input value={newFeature} onChange={(e) => setNewFeature(e.target.value)} placeholder="e.g. Priority Search Visibility" maxLength={120} className="w-full rounded-lg border bg-background px-3 py-2" />
              </label>
              <button type="button" onClick={addFeature} disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Add feature</button>
            </div>
            {featureError && <p className="text-xs font-medium text-destructive">{featureError}</p>}

            {features.map((feature, index) => (
              <div key={index} className="flex items-start justify-between gap-4 rounded-lg border px-4 py-3">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">Feature #{index + 1}</span>
                    <button type="button" onClick={() => removeFeature(index)} disabled={saving} aria-label={`Remove feature ${index + 1}`} className="rounded-md border border-destructive/40 px-2 py-0.5 text-xs font-medium text-destructive hover:bg-destructive/10">Remove</button>
                  </div>
                  <label className="block space-y-1">
                    <span className="text-xs text-muted-foreground">Display label</span>
                    <input value={feature.label} onChange={(e) => updateFeature(index, { label: e.target.value })} placeholder="e.g. Appear in Search Results" className="w-full rounded-lg border bg-background px-3 py-2" maxLength={120} />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-muted-foreground">Display order</span>
                    <input type="number" min="0" value={feature.sortOrder} onChange={(e) => updateFeature(index, { sortOrder: Number(e.target.value) })} className="w-full max-w-40 rounded-lg border bg-background px-3 py-2" />
                  </label>
                </div>
                <Switch
                  checked={feature.enabled}
                  onCheckedChange={(checked) => updateFeature(index, { enabled: checked })}
                  aria-label={`Feature ${index + 1} ${feature.enabled ? 'enabled' : 'disabled'}`}
                />
              </div>
            ))}
          </section>

          <section className="space-y-4 border-t pt-4">
            <h2 className="text-lg font-semibold">Stripe</h2>
            <p className="text-xs text-muted-foreground">FREE plans do not require Stripe identifiers. Paid plans must reference valid Stripe Product and Price IDs.</p>
            <Field label="Stripe Product ID" value={form.stripeProductId} onChange={(v) => set('stripeProductId', v)} placeholder="prod_..." />
            <Field label="Stripe Price ID" value={form.stripePriceId} onChange={(v) => set('stripePriceId', v)} placeholder="price_..." />
          </section>

          <button disabled={saving || !planCode || !selected || selected.exists} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {saving ? 'Saving...' : 'Create plan'}
          </button>
        </form>
      )}
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text', min, step, maxLength, hint }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; min?: string; step?: string; maxLength?: number; hint?: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      <input type={type} min={min} step={step} maxLength={maxLength} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-lg border bg-background px-3 py-2" />
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  )
}
