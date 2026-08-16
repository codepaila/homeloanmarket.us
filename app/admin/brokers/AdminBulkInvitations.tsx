'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import { classifyInvitations, classifyRetry, type ToastKind } from '@/lib/operation-toast'
import { X, Send, RotateCcw } from 'lucide-react'

function showToast(result: { kind: ToastKind; message: string }) {
  if (result.kind === 'success') toast.success(result.message)
  else if (result.kind === 'error') toast.error(result.message)
  else toast(result.message, { icon: '⚠️' })
}

type BrokerRow = {
  id: string
  displayName: string
  companyName: string | null
  nmls: string | null
  email: string | null
  profileSlug: string
  userId: string | null
  creationSource: string | null
  brokerStatus: string
  verificationStatus: string
  isVisible: boolean
  subscription: { plan: string; isActive: boolean } | null
  claimStatus: string | null
  latestInvitation: { id: string; recipientEmail: string; status: string; expiresAt: string | null; createdAt: string } | null
}

type BulkResult = {
  brokerId: string
  brokerName: string
  recipientEmail: string
  status: 'SENT' | 'FAILED' | 'SKIPPED'
  errorCode?: string
  errorMessage?: string
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isEligible(broker: BrokerRow) {
  return broker.userId === null && broker.creationSource === 'ADMIN_CREATED' && broker.brokerStatus !== 'SUSPENDED' && broker.claimStatus !== 'COMPLETED'
}

function invitationBadge(broker: BrokerRow) {
  if (!broker.claimStatus) return { label: 'NOT INVITED', tone: 'bg-slate-100 text-slate-700' }
  const map: Record<string, { label: string; tone: string }> = {
    INVITED: { label: 'INVITATION SENT', tone: 'bg-blue-100 text-blue-800' },
    IN_PROGRESS: { label: 'CLAIM IN PROGRESS', tone: 'bg-purple-100 text-purple-800' },
    COMPLETED: { label: 'CLAIMED', tone: 'bg-emerald-100 text-emerald-800' },
    EXPIRED: { label: 'EXPIRED', tone: 'bg-amber-100 text-amber-800' },
    REVOKED: { label: 'REVOKED', tone: 'bg-rose-100 text-rose-800' },
    FAILED: { label: 'FAILED', tone: 'bg-red-100 text-red-800' },
  }
  return map[broker.claimStatus] || { label: broker.claimStatus, tone: 'bg-slate-100 text-slate-700' }
}

export default function AdminBulkInvitations({ brokers }: { brokers: BrokerRow[] }) {
  const router = useRouter()
  const eligible = useMemo(() => brokers.filter(isEligible), [brokers])
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [dialogOpen, setDialogOpen] = useState(false)
  const [step, setStep] = useState<'review' | 'confirm' | 'results'>('review')
  const [emails, setEmails] = useState<Record<string, string>>({})
  const [results, setResults] = useState<BulkResult[]>([])
  const [summary, setSummary] = useState<{ total: number; sent: number; failed: number; skipped: number } | null>(null)
  const [sending, setSending] = useState(false)

  const selectedBrokers = eligible.filter((broker) => selected[broker.id])
  const allPageSelected = eligible.length > 0 && eligible.every((broker) => selected[broker.id])

  function toggle(id: string, checked: boolean) {
    setSelected((current) => ({ ...current, [id]: checked }))
  }
  function toggleSelectAll() {
    setSelected((current) => {
      const next = { ...current }
      for (const broker of eligible) {
        if (allPageSelected) delete next[broker.id]
        else next[broker.id] = true
      }
      return next
    })
  }
  function clearSelection() {
    setSelected({})
  }

  function openDialog() {
    const initial: Record<string, string> = {}
    for (const broker of selectedBrokers) {
      if (broker.email && EMAIL_PATTERN.test(broker.email)) initial[broker.id] = broker.email
    }
    setEmails(initial)
    setResults([])
    setSummary(null)
    setStep('review')
    setDialogOpen(true)
  }

  const validCount = selectedBrokers.filter((broker) => EMAIL_PATTERN.test((emails[broker.id] || '').trim())).length
  const invalidCount = selectedBrokers.length - validCount

  async function send(onlyFailed = false) {
    setSending(true)
    try {
      const items = onlyFailed
        ? results.filter((result) => result.status === 'FAILED').map((result) => ({ brokerId: result.brokerId, recipientEmail: result.recipientEmail }))
        : selectedBrokers.map((broker) => ({ brokerId: broker.id, recipientEmail: (emails[broker.id] || '').trim() }))

      const response = await fetch('/api/admin/brokers/bulk-claim-invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      const data = await response.json()
      if (!response.ok) {
        toast.error(onlyFailed ? 'Unable to retry invitations.' : 'Unable to send invitations.')
        return
      }
      setSummary(data.summary || null)
      setResults(data.results || [])
      setStep('results')
      showToast(onlyFailed ? classifyRetry(data.summary) : classifyInvitations(data.summary))
      router.refresh()
    } catch {
      toast.error(onlyFailed ? 'Unable to retry invitations.' : 'Unable to send invitations.')
    } finally {
      setSending(false)
    }
  }

  const failedResults = results.filter((result) => result.status === 'FAILED')

  return (
    <div className="space-y-4">
      {selectedBrokers.length > 0 && (
        <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3 shadow-lg">
          <p className="text-sm font-medium">{selectedBrokers.length} broker{selectedBrokers.length === 1 ? '' : 's'} selected</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={openDialog} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Send className="h-4 w-4" />Send Invitations</button>
            <button type="button" onClick={clearSelection} className="rounded-lg border px-4 py-2 text-sm font-semibold">Clear</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[1000px] text-left text-sm">
          <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">
                {eligible.length > 0 && <input type="checkbox" aria-label="Select all eligible brokers on this page" checked={allPageSelected} onChange={toggleSelectAll} className="h-4 w-4 accent-primary" />}
              </th>
              <th className="px-4 py-3">Broker</th>
              <th className="px-4 py-3">Ownership</th>
              <th className="px-4 py-3">Verification</th>
              <th className="px-4 py-3">Subscription</th>
              <th className="px-4 py-3">Visibility</th>
              <th className="px-4 py-3">Invitation</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {brokers.map((broker) => {
              const badge = invitationBadge(broker)
              const eligibleBroker = isEligible(broker)
              return (
                <tr key={broker.id} className="align-top">
                  <td className="px-4 py-4">
                    {eligibleBroker && <input type="checkbox" aria-label={`Select ${broker.companyName || broker.displayName}`} checked={Boolean(selected[broker.id])} onChange={(event) => toggle(broker.id, event.target.checked)} className="h-4 w-4 accent-primary" />}
                  </td>
                  <td className="px-4 py-4">
                    <Link href={`/admin/brokers/${broker.id}`} className="font-semibold hover:underline">{broker.companyName || broker.displayName}</Link>
                    <p className="text-xs text-muted-foreground">{broker.displayName}</p>
                    {broker.nmls && <p className="text-xs text-muted-foreground">NMLS {broker.nmls}</p>}
                    {broker.email && <p className="text-xs text-muted-foreground">{broker.email}</p>}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${broker.userId ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{broker.userId ? 'OWNED' : 'UNOWNED'}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${broker.verificationStatus === 'VERIFIED' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{broker.verificationStatus}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-xs">{broker.subscription?.plan || 'FREE'}</span>
                    {broker.subscription && !broker.subscription.isActive && <span className="ml-1 text-xs text-muted-foreground">/ INACTIVE</span>}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${broker.isVisible ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{broker.isVisible ? 'PUBLISHED' : 'HIDDEN'}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${badge.tone}`}>{badge.label}</span>
                    {broker.latestInvitation && <p className="mt-1 text-xs text-muted-foreground">{broker.latestInvitation.recipientEmail}</p>}
                  </td>
                  <td className="px-4 py-4 text-xs text-muted-foreground">{broker.latestInvitation?.createdAt ? new Date(broker.latestInvitation.createdAt).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-4 text-right">
                    <Link href={`/admin/brokers/${broker.id}`} className="font-medium text-primary hover:underline">Open</Link>
                  </td>
                </tr>
              )
            })}
            {brokers.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">No brokers match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !sending && setDialogOpen(false)} aria-hidden="true" />
          <div role="dialog" aria-modal="true" aria-label="Send broker invitations" className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border bg-card p-6 shadow-xl">
            {step === 'review' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Send broker invitations</h2>
                    <p className="text-sm text-muted-foreground">Selected brokers: {selectedBrokers.length}</p>
                  </div>
                  <button type="button" onClick={() => setDialogOpen(false)} className="rounded-full p-2 hover:bg-muted" aria-label="Close"><X className="h-5 w-5" /></button>
                </div>
                <div className="space-y-2">
                  {selectedBrokers.map((broker) => {
                    const value = emails[broker.id] || ''
                    const invalid = !EMAIL_PATTERN.test(value.trim())
                    return (
                      <div key={broker.id} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_1fr]">
                        <div>
                          <p className="text-sm font-medium">{broker.companyName || broker.displayName}</p>
                          {broker.nmls && <p className="text-xs text-muted-foreground">NMLS {broker.nmls}</p>}
                        </div>
                        <div>
                          <input type="email" placeholder="recipient@example.com" value={value} onChange={(event) => setEmails({ ...emails, [broker.id]: event.target.value })} aria-label={`Recipient email for ${broker.companyName || broker.displayName}`} className={`w-full rounded-lg border bg-background px-3 py-2 text-sm ${invalid ? 'border-destructive' : ''}`} />
                          {invalid && <p className="mt-1 text-xs text-destructive">Recipient email required</p>}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="flex justify-end gap-2 border-t pt-4">
                  <button type="button" onClick={() => setDialogOpen(false)} className="rounded-lg border px-4 py-2 text-sm font-semibold">Cancel</button>
                  <button type="button" disabled={validCount === 0} onClick={() => setStep('confirm')} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Review {validCount} invitation{validCount === 1 ? '' : 's'}</button>
                </div>
              </div>
            )}

            {step === 'confirm' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Send broker invitations?</h2>
                  <button type="button" onClick={() => setStep('review')} className="rounded-full p-2 hover:bg-muted" aria-label="Back"><X className="h-5 w-5" /></button>
                </div>
                <p className="text-sm text-muted-foreground">You are about to send {validCount} invitation email{validCount === 1 ? '' : 's'}. Each recipient will receive a secure broker-claim link.</p>
                <div className="rounded-lg bg-muted p-3 text-sm">
                  <p>{validCount} valid</p>
                  {invalidCount > 0 && <p className="text-destructive">{invalidCount} invalid email{invalidCount === 1 ? '' : 's'}</p>}
                </div>
                <div className="flex justify-end gap-2 border-t pt-4">
                  <button type="button" onClick={() => setStep('review')} className="rounded-lg border px-4 py-2 text-sm font-semibold">Back</button>
                  <button type="button" disabled={sending} onClick={() => send(false)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{sending ? 'Sending…' : `Send ${validCount} Invitation${validCount === 1 ? '' : 's'}`}</button>
                </div>
              </div>
            )}

            {step === 'results' && summary && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Invitations Sent</h2>
                  <button type="button" onClick={() => setDialogOpen(false)} className="rounded-full p-2 hover:bg-muted" aria-label="Close"><X className="h-5 w-5" /></button>
                </div>
                <p className="text-sm text-muted-foreground">{summary.sent} of {summary.total} invitation{summary.total === 1 ? '' : 's'} were accepted by the email provider.</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg bg-emerald-50 p-3 text-center"><p className="text-2xl font-semibold text-emerald-700">{summary.sent}</p><p className="text-xs text-emerald-700">Accepted</p></div>
                  <div className="rounded-lg bg-amber-50 p-3 text-center"><p className="text-2xl font-semibold text-amber-700">{summary.skipped}</p><p className="text-xs text-amber-700">Skipped</p></div>
                  <div className="rounded-lg bg-red-50 p-3 text-center"><p className="text-2xl font-semibold text-red-700">{summary.failed}</p><p className="text-xs text-red-700">Failed</p></div>
                </div>
                <div className="max-h-64 space-y-1 overflow-y-auto border-t pt-3 text-sm">
                  {results.map((result) => (
                    <div key={result.brokerId} className="flex items-center justify-between gap-2 border-b py-1.5">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{result.brokerName || result.brokerId}</p>
                        <p className="truncate text-xs text-muted-foreground">{result.recipientEmail}</p>
                      </div>
                      <div className="text-right">
                        <span className={`font-semibold ${result.status === 'SENT' ? 'text-emerald-700' : result.status === 'SKIPPED' ? 'text-amber-700' : 'text-red-700'}`}>{result.status}</span>
                        {result.status === 'SENT' && <p className="text-xs text-muted-foreground">Invitation email accepted</p>}
                        {result.errorMessage && <p className="text-xs text-muted-foreground">{result.errorMessage}</p>}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                  {failedResults.length > 0 && <button type="button" disabled={sending} onClick={() => send(true)} className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold"><RotateCcw className="h-4 w-4" />Retry failed ({failedResults.length})</button>}
                  <button type="button" onClick={() => setDialogOpen(false)} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Done</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
