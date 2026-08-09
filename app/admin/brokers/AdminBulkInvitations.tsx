'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type BrokerOption = { id: string; displayName: string; companyName: string | null; userId: string | null; creationSource: string | null; brokerStatus: string }
type Result = { brokerId: string; status: string; code?: string }

export default function AdminBulkInvitations({ brokers }: { brokers: BrokerOption[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [emails, setEmails] = useState<Record<string, string>>({})
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)

  const eligible = brokers.filter((broker) => broker.userId === null && broker.creationSource === 'ADMIN_CREATED' && broker.brokerStatus !== 'SUSPENDED')
  const selectedBrokers = eligible.filter((broker) => selected[broker.id])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    try {
      const response = await fetch('/api/admin/brokers/bulk-claim-invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: selectedBrokers.map((broker) => ({ brokerId: broker.id, recipientEmail: emails[broker.id] })) }),
      })
      const data = await response.json()
      setResults(data.results || [{ brokerId: '', status: 'FAILED', code: data.message || 'REQUEST_FAILED' }])
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  if (eligible.length === 0) return null

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border bg-card p-4">
      <div><h2 className="font-semibold">Bulk Invitations</h2><p className="text-sm text-muted-foreground">Select unowned admin-created profiles and provide one recipient email per profile.</p></div>
      <div className="space-y-2">
        {eligible.map((broker) => <div key={broker.id} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[auto_1fr_1fr] sm:items-center"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(selected[broker.id])} onChange={(event) => setSelected({ ...selected, [broker.id]: event.target.checked })} /><span>{broker.companyName || broker.displayName}</span></label><span className="text-xs text-muted-foreground">UNOWNED · ADMIN_CREATED</span>{selected[broker.id] && <input required type="email" placeholder="recipient@example.com" value={emails[broker.id] || ''} onChange={(event) => setEmails({ ...emails, [broker.id]: event.target.value })} className="rounded-lg border bg-background px-3 py-2 text-sm" />}</div>)}
      </div>
      <button disabled={loading || selectedBrokers.length === 0} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{loading ? 'Sending...' : `Send ${selectedBrokers.length || ''} Invitation${selectedBrokers.length === 1 ? '' : 's'}`}</button>
      {results.length > 0 && <div className="space-y-1 border-t pt-3 text-sm">{results.map((result, index) => <p key={`${result.brokerId}-${index}`} className={result.status === 'SENT' ? 'text-emerald-700' : 'text-destructive'}>{result.status === 'SENT' ? '✓ Sent' : `✕ ${result.code || result.status}`} {result.brokerId && `(${result.brokerId})`}</p>)}</div>}
    </form>
  )
}
