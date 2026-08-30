'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { Loader2 } from 'lucide-react'

type SubscriptionRow = {
  id: string
  plan: string
  planId: string | null
  isActive: boolean
  startDate?: string | Date | null
  endDate?: string | Date | null
  stripeSubId: string | null
  migrationStatus: 'linked' | 'legacy-eligible' | 'unknown'
  broker: { id: string; displayName: string; email: string | null; companyName: string | null; creationSource: string | null }
  planRef: { id: string; code: string; name: string; isActive: boolean } | null
}

type Summary = {
  total: number
  active: number
  linked: number
  needsMigration: number
  unknownPlan: number
  stripeBacked: number
}

type AdminAudit = {
  adminCreatedBrokers: number
  alreadySubscribed: number
  missingSubscription: number
  legacyFreeUnlinked: number
  unknownCreationSource: number
}

function maskStripeId(id: string | null) {
  if (!id) return '—'
  if (id.length <= 10) return id
  return `${id.slice(0, 6)}…${id.slice(-4)}`
}

export default function BrokerSubscriptionsClient({ subscriptions, summary, adminAudit }: { subscriptions: SubscriptionRow[]; summary: Summary; adminAudit: AdminAudit }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState<Record<string, unknown> | null>(null)

  async function reconcile() {
    if (busy) return
    setBusy(true)
    setReport(null)
    try {
      const response = await fetch('/api/admin/broker-subscriptions/reconcile', { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to reconcile')
      setReport({ kind: 'reconcile', ...data.report })
      toast.success('Reconciliation complete.')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to reconcile')
    } finally {
      setBusy(false)
    }
  }

  async function backfillFree() {
    if (busy) return
    setBusy(true)
    setReport(null)
    try {
      const response = await fetch('/api/admin/broker-subscriptions/backfill-free', { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to backfill')
      setReport({ kind: 'backfill', ...data.report })
      toast.success('FREE backfill complete.')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to backfill')
    } finally {
      setBusy(false)
    }
  }

  const summaryCards = [
    { label: 'Total subscriptions', value: summary.total },
    { label: 'Active subscriptions', value: summary.active },
    { label: 'Linked to dynamic plans', value: summary.linked },
    { label: 'Needs migration', value: summary.needsMigration },
    { label: 'Unknown plan codes', value: summary.unknownPlan },
    { label: 'Stripe-backed subscriptions', value: summary.stripeBacked },
  ]

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Billing</p>
        <h1 className="text-3xl font-semibold tracking-tight">Broker Subscriptions</h1>
        <p className="mt-1 text-sm text-muted-foreground">Inspect broker subscriptions, migrate legacy records to dynamic plans, and monitor billing state.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded-xl border bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold">{card.value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Admin-created / imported brokers</h2>
        <p className="mt-1 text-sm text-muted-foreground">Admin-created brokers should each have a linked FREE subscription. This metric should normally be 0.</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <AuditStat label="Admin-created brokers" value={adminAudit.adminCreatedBrokers} />
          <AuditStat label="Already subscribed" value={adminAudit.alreadySubscribed} />
          <AuditStat label="Missing subscription" value={adminAudit.missingSubscription} />
          <AuditStat label="FREE — legacy / needs linking" value={adminAudit.legacyFreeUnlinked} />
          <AuditStat label="Unknown creation source" value={adminAudit.unknownCreationSource} />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" onClick={reconcile} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Reconcile Legacy Subscriptions
          </button>
          <button type="button" onClick={backfillFree} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50">
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Create missing FREE subscriptions (admin-created brokers)
          </button>
        </div>
        {report && <ReconcileReport report={report} />}
      </section>

      <div className="overflow-x-auto rounded-xl border bg-card">
        {subscriptions.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-foreground">No broker subscriptions found</p>
            <p className="mt-1 text-sm text-muted-foreground">Broker subscriptions will appear here once brokers are created or imported.</p>
          </div>
        ) : (
        <table className="w-full min-w-[1000px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3">Broker</th>
              <th className="px-4 py-3">Plan code</th>
              <th className="px-4 py-3">Dynamic plan</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3">Stripe subscription</th>
              <th className="px-4 py-3">Start</th>
              <th className="px-4 py-3">End</th>
              <th className="px-4 py-3">Migration</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {subscriptions.map((subscription) => (
              <tr key={subscription.id}>
                <td className="px-4 py-3">
                  <div className="font-semibold text-foreground">{subscription.broker.displayName || subscription.broker.companyName || '—'}</div>
                  <div className="text-xs text-muted-foreground">{subscription.broker.email || '—'}</div>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs">{subscription.plan}</span>
                </td>
                <td className="px-4 py-3">
                  {subscription.planRef ? (
                    <span className="text-sm">{subscription.planRef.name} <span className="text-xs text-muted-foreground">({subscription.planRef.code})</span></span>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-3"><StatusBadge linked={Boolean(subscription.planId)} /></td>
                <td className="px-4 py-3">{subscription.isActive ? <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600">Active</span> : <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Inactive</span>}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{maskStripeId(subscription.stripeSubId)}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{subscription.startDate ? new Date(subscription.startDate).toLocaleDateString() : '—'}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{subscription.endDate ? new Date(subscription.endDate).toLocaleDateString() : '—'}</td>
                <td className="px-4 py-3"><MigrationBadge status={subscription.migrationStatus} /></td>
                <td className="px-4 py-3">
                  <Link href={`/admin/billing/broker-subscriptions/${subscription.id}`} className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-foreground">View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>
    </div>
  )
}

function AuditStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  )
}

function StatusBadge({ linked }: { linked: boolean }) {
  return linked ? (
    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600">Linked</span>
  ) : (
    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700">Unlinked</span>
  )
}

function MigrationBadge({ status }: { status: SubscriptionRow['migrationStatus'] }) {
  if (status === 'linked') return <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600">✓ Linked</span>
  if (status === 'legacy-eligible') return <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700">Legacy — eligible</span>
  return <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">Unknown legacy plan</span>
}

function ReconcileReport({ report }: { report: Record<string, unknown> }) {
  const kind = report.kind === 'reconcile' ? 'Reconciliation' : 'FREE backfill'
  return (
    <div className="mt-4 rounded-lg border p-4 text-sm">
      <p className="font-semibold">{kind} report</p>
      <pre className="mt-2 whitespace-pre-wrap rounded bg-muted/40 p-3 text-xs">{JSON.stringify(report, null, 2)}</pre>
    </div>
  )
}