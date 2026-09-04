'use client'

import { useState } from 'react'
import { toast } from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { Loader2, RefreshCw, Plug, Copy, Save, KeyRound, ShieldCheck } from 'lucide-react'

type StripeEventMeta = {
  type: string
  label: string
  purpose: string
  critical: boolean
  enabled: boolean
}

type StripeConnection =
  | { ok: true; accountId: string | null; mode: string; businessName: string | null; country: string | null; defaultCurrency: string | null; message: string }
  | { ok: false; error: string }

type RecentEvent = {
  id: string
  eventId: string
  eventType: string
  status: string
  eventCreatedAt: number
  processedAt: string | null
  createdAt: string | Date
  error: string | null
}

type AuditEntry = {
  action: string
  actorId: string | null
  createdAt: string
  note: string | null
}

type StripeStatus = {
  configured: { secretKey: boolean; webhookSecret: boolean }
  mode: string
  connection: StripeConnection
  webhook: { endpoint: string; signatureVerification: boolean }
  events: StripeEventMeta[]
  audit: { secretKey: AuditEntry[]; webhookSecret: AuditEntry[] }
  recentEvents: RecentEvent[]
}

export function StripeConfigClient({ status }: { status: StripeStatus }) {
  const router = useRouter()
  const [events, setEvents] = useState<StripeEventMeta[]>(status.events)
  const [testing, setTesting] = useState(false)
  const [savingEvents, setSavingEvents] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [copied, setCopied] = useState(false)

  // Secret save/replace state
  const [secretKeyValue, setSecretKeyValue] = useState('')
  const [webhookSecretValue, setWebhookSecretValue] = useState('')
  const [savingSecret, setSavingSecret] = useState<null | 'secretKey' | 'webhookSecret'>(null)

  const connected = status.connection.ok === true

  async function testConnection() {
    if (testing) return
    setTesting(true)
    setTestResult(null)
    try {
      const response = await fetch('/api/admin/stripe/test', { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Stripe connection test failed')
      setTestResult({ ok: true, message: data.message || 'Stripe connection successful' })
      toast.success('Stripe connection successful')
      router.refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Stripe connection failed'
      setTestResult({ ok: false, message })
      toast.error(message)
    } finally {
      setTesting(false)
    }
  }

  async function toggleEvent(type: string) {
    if (savingEvents) return
    const next = events.map((event) => (event.type === type ? { ...event, enabled: !event.enabled } : event))
    setSavingEvents(true)
    try {
      const enabledTypes = next.filter((event) => event.enabled).map((event) => event.type)
      const response = await fetch('/api/admin/stripe/events', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabledTypes }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to update event configuration')
      setEvents(data.events)
      toast.success('Stripe event configuration updated.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update event configuration')
    } finally {
      setSavingEvents(false)
    }
  }

  async function saveSecret(field: 'secretKey' | 'webhookSecret') {
    if (savingSecret) return
    const value = field === 'secretKey' ? secretKeyValue : webhookSecretValue
    if (!value.trim()) {
      toast.error('A secret value is required')
      return
    }
    const alreadyConfigured = field === 'secretKey' ? status.configured.secretKey : status.configured.webhookSecret
    const replace = alreadyConfigured
    setSavingSecret(field)
    try {
      const response = await fetch('/api/admin/stripe/secrets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, value, replace }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to save secret')
      toast.success(field === 'secretKey' ? 'Stripe Secret Key saved (encrypted at rest).' : 'Webhook Signing Secret saved (encrypted at rest).')
      if (field === 'secretKey') setSecretKeyValue('')
      else setWebhookSecretValue('')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save secret')
    } finally {
      setSavingSecret(null)
    }
  }

  async function copyEndpoint() {
    try {
      await navigator.clipboard.writeText(status.webhook.endpoint)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Unable to copy webhook endpoint')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Billing</p>
          <h1 className="text-3xl font-semibold tracking-tight">Stripe Configuration</h1>
          <p className="mt-1 text-sm text-muted-foreground">Inspect and manage the platform&apos;s Stripe operational configuration and webhook events.</p>
        </div>
        <button type="button" onClick={() => router.refresh()} className="rounded border px-3 py-2 text-sm font-medium">
          <RefreshCw className="mr-1.5 inline h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* A. Stripe Connection + B. Mode */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded border bg-card p-5">
          <h2 className="text-lg font-semibold">Stripe Connection</h2>
          <div className="mt-3 flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${connected ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-700'}`}>
              <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-amber-500'}`} aria-hidden="true" />
              {connected ? 'Connected' : status.configured.secretKey ? 'Connection failed' : 'Not configured'}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm font-medium capitalize text-muted-foreground">
              {status.mode === 'unknown' ? 'Mode unknown' : `${status.mode} mode`}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Stripe mode is controlled by server configuration and cannot be switched from the browser.
          </p>
        </div>

        <div className="rounded border bg-card p-5">
          <h2 className="text-lg font-semibold">Account</h2>
          {status.connection.ok ? (
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Account ID" value={status.connection.accountId || '—'} />
              <Row label="Business name" value={status.connection.businessName || '—'} />
              <Row label="Country" value={status.connection.country || '—'} />
              <Row label="Default currency" value={status.connection.defaultCurrency || '—'} />
            </dl>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              {status.connection.ok ? '' : status.connection.error}
            </p>
          )}
        </div>
      </section>

      {/* C. API Configuration */}
      <section className="rounded border bg-card p-5">
        <h2 className="text-lg font-semibold">API Configuration</h2>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <SecretEditor
            label="Stripe Secret Key"
            configured={status.configured.secretKey}
            note="Required for server-side billing. Encrypted at rest. Never displayed in full."
            value={secretKeyValue}
            onChange={setSecretKeyValue}
            onSave={() => saveSecret('secretKey')}
            saving={savingSecret === 'secretKey'}
            buttonLabel={status.configured.secretKey ? 'Replace Secret' : 'Save Secret Key'}
            placeholder="Paste the Stripe secret key"
          />
          <SecretEditor
            label="Stripe Webhook Signing Secret"
            configured={status.configured.webhookSecret}
            note="Required for webhook signature verification. Encrypted at rest."
            value={webhookSecretValue}
            onChange={setWebhookSecretValue}
            onSave={() => saveSecret('webhookSecret')}
            saving={savingSecret === 'webhookSecret'}
            buttonLabel={status.configured.webhookSecret ? 'Replace Secret' : 'Save Webhook Secret'}
            placeholder="Paste the webhook signing secret"
          />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Secrets are stored encrypted at rest in a dedicated secure store and are never returned to the browser. The previous secret is never displayed.
        </p>
      </section>

      {/* D. Webhook Configuration */}
      <section className="rounded border bg-card p-5">
        <h2 className="text-lg font-semibold">Webhook Configuration</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <dt className="text-muted-foreground">Endpoint</dt>
            <dd className="flex items-center gap-2">
              <code className="rounded bg-muted px-2 py-1 text-xs">{status.webhook.endpoint}</code>
              <button type="button" onClick={copyEndpoint} className="rounded border px-2 py-1 text-xs font-medium">
                {copied ? 'Copied' : <Copy className="inline h-3 w-3" aria-hidden="true" />}
              </button>
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Webhook Signing Secret</dt>
            <dd className="text-sm font-medium">●●●●●●●●●●●● <span className="text-muted-foreground">{status.configured.webhookSecret ? 'Configured' : 'Not configured'}</span></dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Signature verification</dt>
            <dd>{status.webhook.signatureVerification ? 'Enabled' : 'Disabled'}</dd>
          </div>
        </dl>
      </section>

      {/* E. Required Events */}
      <section className="rounded border bg-card p-5">
        <h2 className="text-lg font-semibold">Required Stripe Events</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          These billing-critical events must always remain enabled and cannot be disabled. They drive subscription activation and synchronization.
        </p>
        <div className="mt-3 space-y-2">
          {events.filter((event) => event.critical).map((event) => (
            <div key={event.type} className="flex flex-wrap items-center justify-between gap-3 rounded border px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  <code>{event.type}</code>
                  <span className="ml-2 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">Critical</span>
                </p>
                <p className="text-xs text-muted-foreground">{event.purpose}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600">Enabled (Mandatory)</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* F. Optional Events */}
      <section className="rounded border bg-card p-5">
        <h2 className="text-lg font-semibold">Optional Stripe Events</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          These events may be enabled or disabled by an administrator. Disabling an optional event only skips its processing in the webhook; idempotency is preserved.
        </p>
        <div className="mt-3 space-y-2">
          {events.filter((event) => !event.critical).map((event) => (
            <div key={event.type} className="flex flex-wrap items-center justify-between gap-3 rounded border px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium"><code>{event.type}</code></p>
                <p className="text-xs text-muted-foreground">{event.purpose}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${event.enabled ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
                  {event.enabled ? 'Enabled' : 'Disabled'}
                </span>
                <button
                  type="button"
                  disabled={savingEvents}
                  onClick={() => toggleEvent(event.type)}
                  className="rounded border px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {event.enabled ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* G. Stripe Dashboard Setup Instructions */}
      <section className="rounded border bg-card p-5">
        <h2 className="text-lg font-semibold">Stripe Dashboard Webhook Setup</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          To configure this platform&apos;s webhook in the Stripe Dashboard, create a webhook endpoint pointing at the canonical endpoint below and subscribe it to the events listed here. Use the platform&apos;s <em>live</em> endpoint for production and the <em>test</em> endpoint when using test mode keys.
        </p>
        <div className="mt-3 rounded border bg-muted/40 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Webhook Endpoint</p>
          <code className="mt-1 block break-all rounded bg-muted px-2 py-1 text-sm">{status.webhook.endpoint}</code>
        </div>
        <div className="mt-3 space-y-2">
          <p className="text-sm font-medium">Events to subscribe</p>
          {events.map((event) => (
            <div key={event.type} className="flex items-start justify-between gap-3 rounded border px-4 py-2">
              <div>
                <p className="text-sm font-medium"><code>{event.type}</code>{event.critical && <span className="ml-2 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">Critical</span>}</p>
                <p className="text-xs text-muted-foreground">{event.purpose}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${event.critical ? 'bg-destructive/10 text-destructive' : event.enabled ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
                {event.critical ? 'Must remain enabled' : event.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded border p-4 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Obtaining the signing secret</p>
          <p className="mt-2 text-muted-foreground">
            After creating the webhook endpoint in the Stripe Dashboard, copy the webhook signing secret (a string beginning with the letters <code>wh</code> followed by <code>sec</code> and an underscore) from the endpoint&apos;s details (Reveal signing secret). Paste it into the <strong>Stripe Webhook Signing Secret</strong> field under API Configuration above and save it. The same secret must match the one Stripe uses to sign webhook payloads so signature verification succeeds.
          </p>
        </div>
      </section>

      {/* H. Connection / Webhook Test */}
      <section className="rounded border bg-card p-5">
        <h2 className="text-lg font-semibold">Connection &amp; Webhook Test</h2>
        <p className="mt-1 text-xs text-muted-foreground">Runs a safe, server-side Stripe API request to verify connectivity. No secrets are returned.</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" onClick={testConnection} disabled={testing} className="inline-flex items-center gap-2 rounded bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {testing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plug className="h-4 w-4" aria-hidden="true" />}
            {testing ? 'Testing…' : 'Test Stripe Connection'}
          </button>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm ${status.webhook.signatureVerification ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-700'}`}>
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Webhook signature verification {status.webhook.signatureVerification ? 'configured' : 'not configured'}
          </span>
        </div>
        {testResult && (
          <p className={`mt-3 text-sm ${testResult.ok ? 'text-emerald-600' : 'text-destructive'}`}>{testResult.message}</p>
        )}
      </section>

      {/* I. Configuration Status / Security */}
      <section className="rounded border bg-card p-5">
        <h2 className="text-lg font-semibold">Configuration Status</h2>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Stripe Secret Key</span>
            <StatusValue ok={status.configured.secretKey} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Webhook Signing Secret</span>
            <StatusValue ok={status.configured.webhookSecret} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Signature Verification</span>
            <StatusValue ok={status.webhook.signatureVerification} />
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Secrets are never logged or exposed. Only safe configured/not-configured status is shown.
        </p>
      </section>

      {/* J. Configuration Audit */}
      <section className="rounded border bg-card p-5">
        <h2 className="text-lg font-semibold">Configuration Audit</h2>
        <p className="mt-1 text-xs text-muted-foreground">Records of when Stripe secrets were set or replaced. Values are never recorded — only the action and time.</p>
        <div className="mt-3 space-y-4">
          <AuditBlock title="Stripe Secret Key" entries={status.audit.secretKey} />
          <AuditBlock title="Webhook Signing Secret" entries={status.audit.webhookSecret} />
        </div>
      </section>

      {/* K. Webhook Event Log */}
      <section className="rounded border bg-card p-5">
        <h2 className="text-lg font-semibold">Recent Stripe Events</h2>
        {status.recentEvents.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No Stripe webhook events recorded yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2">Event</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2">Processed</th>
                  <th className="px-3 py-2">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {status.recentEvents.map((event) => (
                  <tr key={event.id}>
                    <td className="px-3 py-2 font-mono text-xs">{event.eventId}</td>
                    <td className="px-3 py-2 font-mono text-xs">{event.eventType}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${event.status === 'PROCESSED' ? 'bg-emerald-500/10 text-emerald-600' : event.status === 'FAILED' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}>
                        {event.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs">{event.eventCreatedAt ? new Date(event.eventCreatedAt * 1000).toLocaleString() : '—'}</td>
                    <td className="px-3 py-2 text-xs">{event.processedAt ? new Date(event.processedAt).toLocaleString() : '—'}</td>
                    <td className="px-3 py-2 text-xs text-destructive">{event.error || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

function StatusValue({ ok }: { ok: boolean }) {
  return ok ? <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600">Configured</span> : <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Not configured</span>
}

function SecretEditor({ label, configured, note, value, onChange, onSave, saving, buttonLabel, placeholder }: {
  label: string
  configured: boolean
  note: string
  value: string
  onChange: (v: string) => void
  onSave: () => void
  saving: boolean
  buttonLabel: string
  placeholder: string
}) {
  return (
    <div className="rounded border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{label}</p>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${configured ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
          {configured ? 'Configured' : 'Not configured'}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
        <KeyRound className="h-3 w-3" aria-hidden="true" />
        <span>{configured ? 'A secret is currently set (masked). Use Replace to overwrite it.' : 'No secret set yet.'}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
      <div className="mt-3 flex gap-2">
        <input
          type="password"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full rounded border bg-background px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !value.trim()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
          {saving ? 'Saving…' : buttonLabel}
        </button>
      </div>
    </div>
  )
}

function AuditBlock({ title, entries }: { title: string; entries: AuditEntry[] }) {
  return (
    <div>
      <p className="text-sm font-medium">{title}</p>
      {entries.length === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">No configuration changes recorded.</p>
      ) : (
        <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
          {entries.map((entry, index) => (
            <li key={index} className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-muted px-2 py-0.5 font-medium uppercase">{entry.action}</span>
              <span>{new Date(entry.createdAt).toLocaleString()}</span>
              {entry.note && <span>· {entry.note}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}