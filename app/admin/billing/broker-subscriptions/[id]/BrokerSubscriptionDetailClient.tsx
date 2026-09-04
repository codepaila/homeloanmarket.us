'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { Loader2 } from 'lucide-react'

type Subscription = {
  id: string
  plan: string
  planId: string | null
  isActive: boolean
  startDate: string | null
  endDate: string | null
  stripeCustomerId: string | null
  stripeSubId: string | null
  createdAt: string | Date
  updatedAt: string | Date
  broker: {
    id: string
    displayName: string
    email: string | null
    companyName: string | null
    profileSlug: string
    creationSource: string | null
    createdAt: string
    user: { id: string; name: string | null; email: string | null } | null
  }
  planRef: { id: string; code: string; name: string; isActive: boolean; features: { id: string; label: string; enabled: boolean; sortOrder: number }[] } | null
}

type MigrationStatus = 'linked' | 'legacy-eligible' | 'unknown' | 'no-plan' | 'ambiguous'
type PlannedFeatures = string[]

function maskStripeId(id: string | null) {
  if (!id) return '—'
  if (id.length <= 10) return id
  return `${id.slice(0, 6)}…${id.slice(-4)}`
}

export default function BrokerSubscriptionDetailClient({
  subscription,
  migrationStatus,
  matchingPlan,
  features,
}: {
  subscription: Subscription
  migrationStatus: MigrationStatus
  matchingPlan: { id: string; code: string; name: string; isActive: boolean } | null
  features: PlannedFeatures
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function migrate() {
    if (busy) return
    setBusy(true)
    try {
      const response = await fetch(`/api/admin/broker-subscriptions/${subscription.id}`, { method: 'PATCH' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to migrate')
      toast.success('Subscription linked to dynamic plan.')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to migrate')
    } finally {
      setBusy(false)
    }
  }

  const linked = Boolean(subscription.planId)

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Billing / Broker Subscriptions</p>
          <h1 className="text-3xl font-semibold tracking-tight">{subscription.broker.displayName || subscription.broker.companyName || 'Broker'}</h1>
          <p className="mt-1 text-sm text-muted-foreground">/{subscription.broker.profileSlug}</p>
        </div>
        <Link href="/admin/billing/broker-subscriptions" className="rounded border px-3 py-2 text-sm font-medium">Back</Link>
      </div>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded border bg-card p-5">
          <h2 className="text-lg font-semibold">Broker</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Name" value={subscription.broker.displayName || '—'} />
            <Row label="Email" value={subscription.broker.email || '—'} />
            <Row label="Company" value={subscription.broker.companyName || '—'} />
            <Row label="Creation source" value={subscription.broker.creationSource || 'Unknown'} />
            <Row label="Created" value={new Date(subscription.broker.createdAt).toLocaleDateString()} />
            {subscription.broker.user && <Row label="Account owner" value={subscription.broker.user.email || '—'} />}
          </dl>
        </div>

        <div className="rounded border bg-card p-5">
          <h2 className="text-lg font-semibold">Subscription</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Active" value={subscription.isActive ? 'Yes' : 'No'} />
            <Row label="Start date" value={subscription.startDate ? new Date(subscription.startDate).toLocaleDateString() : '—'} />
            <Row label="End date" value={subscription.endDate ? new Date(subscription.endDate).toLocaleDateString() : '—'} />
            <Row label="Stripe customer" value={maskStripeId(subscription.stripeCustomerId)} />
            <Row label="Stripe subscription" value={maskStripeId(subscription.stripeSubId)} />
          </dl>
        </div>
      </section>

      <section className="rounded border bg-card p-5">
        <h2 className="text-lg font-semibold">Plan &amp; Migration</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div className="rounded border p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Current stored plan code</p>
            <p className="mt-1 text-xl font-semibold font-mono">{subscription.plan}</p>
          </div>
          <div className="rounded border p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Dynamic database plan</p>
            {subscription.planRef ? (
              <p className="mt-1 text-xl font-semibold">{subscription.planRef.name} <span className="text-sm text-muted-foreground">({subscription.planRef.code})</span></p>
            ) : matchingPlan ? (
              <p className="mt-1 text-xl font-semibold">{matchingPlan.name} <span className="text-sm text-muted-foreground">({matchingPlan.code})</span></p>
            ) : (
              <p className="mt-1 text-muted-foreground">None</p>
            )}
          </div>
        </div>
        <div className="mt-4">
          {linked ? (
            <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-600">✓ Linked</p>
          ) : migrationStatus === 'legacy-eligible' ? (
            <p className="text-sm text-amber-700">Legacy subscription — eligible for migration</p>
          ) : migrationStatus === 'no-plan' ? (
            <p className="text-sm text-destructive">No dynamic plan matches the stored plan code.</p>
          ) : migrationStatus === 'ambiguous' ? (
            <p className="text-sm text-destructive">Multiple/inactive dynamic plans match the stored plan code. Resolve manually.</p>
          ) : (
            <p className="text-sm text-destructive">Unknown legacy plan — requires explicit admin decision.</p>
          )}
        </div>
        {!linked && migrationStatus === 'legacy-eligible' && matchingPlan && (
          <button type="button" onClick={migrate} disabled={busy} className="mt-4 inline-flex items-center gap-2 rounded bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {busy ? 'Linking...' : 'Link to Dynamic Plan'}
          </button>
        )}
        {!linked && migrationStatus !== 'legacy-eligible' && (
          <p className="mt-4 text-xs text-muted-foreground">No migration performed. The stored plan code does not match a unique active dynamic plan.</p>
        )}
      </section>

      <section className="rounded border bg-card p-5">
        <h2 className="text-lg font-semibold">Plan Features</h2>
        {features.length > 0 ? (
          <div className="mt-3 space-y-2">
            {features.map((label) => (
              <div key={label} className="flex items-center justify-between rounded border px-4 py-2 text-sm">
                <span className="font-medium">{label}</span>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600">Included</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No included features listed for the linked plan.</p>
        )}
      </section>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  )
}