'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { Loader2 } from 'lucide-react'
import { ProfileImageUpload } from '@/components/brokers/ProfileImageUpload'
import { CoverImageUpload } from '@/components/brokers/CoverImageUpload'
import { DeleteAccountDialog } from '@/components/account/DeleteAccountDialog'
import { US_STATES } from '@/lib/us-states'

type AdminInvitation = {
  id: string
  recipientEmail: string
  status: string
  expiresAt: string | Date
  createdAt: string | Date
  usedAt?: string | Date | null
  revokedAt?: string | Date | null
}

type AdminBroker = {
  id: string
  displayName: string
  companyName?: string | null
  description: string
  phone: string
  email?: string | null
  officeAddress: string
  city: string | null
  state: string | null
  pinCode: string | null
  nmls: string | null
  licenseStates: string[]
  isVisible: boolean
  verificationStatus: string
  logo?: string | null
  coverImage?: string | null
  profileImage?: string | null
  claim?: { invitations: AdminInvitation[] } | null
}

export default function AdminBrokerActions({ broker }: { broker: AdminBroker }) {
  const router = useRouter()
  const [deliveryEmail, setDeliveryEmail] = useState(broker.claim?.invitations?.find((item) => item.status === 'ACTIVE')?.recipientEmail || broker.email || '')
  const [claimLink, setClaimLink] = useState('')
  const [saving, setSaving] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [form, setForm] = useState({ displayName: broker.displayName, companyName: broker.companyName || '', description: broker.description, phone: broker.phone, email: broker.email || '', officeAddress: broker.officeAddress, city: broker.city || '', state: broker.state || '', pinCode: broker.pinCode, nmls: broker.nmls || '', isVisible: broker.isVisible, verificationStatus: broker.verificationStatus })
  const [licenseStates, setLicenseStates] = useState<string[]>(broker.licenseStates || [])

  async function updateProfile(event: React.FormEvent) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      const response = await fetch(`/api/admin/brokers/${broker.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, licenseStates }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to update broker profile. Please try again.')
      toast.success('Broker profile updated successfully.')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update broker profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function issueInvitation(path: string) {
    if (isSending) return
    setIsSending(true)
    try {
      const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deliveryEmail }) })
      const data = await response.json()
      if (!response.ok) {
        toast.error(data.message || 'Unable to resend the invitation. Please try again.')
        return
      }
      setClaimLink(data.claimLink || '')
      if (data.invitation?.emailSent === false) {
        toast.error('The invitation email could not be sent.')
      } else {
        toast.success(`Invitation email accepted by the email provider${data.invitation ? ` for ${deliveryEmail}` : ''}.`)
      }
      router.refresh()
    } catch {
      toast.error('Unable to resend the invitation. Please try again.')
    } finally {
      setIsSending(false)
    }
  }

  async function resolveLocation() {
    if (saving) return
    setSaving(true)
    try {
      const response = await fetch(`/api/admin/brokers/${broker.id}/location`, { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to resolve location. Please try again.')
      toast.success('Location resolved and saved.')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to resolve location. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function revokeInvitation(id: string) {
    if (isSending) return
    setIsSending(true)
    try {
      const response = await fetch(`/api/admin/claim-invitations/${id}/revoke`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: 'Revoked by administrator' }) })
      const data = await response.json()
      if (!response.ok) {
        toast.error(data.message || 'Unable to revoke invitation.')
        return
      }
      toast.success('Invitation revoked.')
      router.refresh()
    } catch {
      toast.error('Unable to revoke invitation.')
    } finally {
      setIsSending(false)
    }
  }

  const activeInvitation = broker.claim?.invitations?.find((item) => item.status === 'ACTIVE')

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
      <form onSubmit={updateProfile} className="space-y-4 rounded-xl border bg-card p-6">
        <h2 className="text-xl font-semibold">Profile details</h2>
        <div className="flex flex-col sm:flex-row items-start gap-4">
          <ProfileImageUpload
            value={broker.profileImage}
            uploadUrl={`/api/admin/brokers/${broker.id}/profile-image`}
            removeUrl={`/api/admin/brokers/${broker.id}/profile-image`}
            label="Profile image"
            helperText="Professional broker photo shown on public cards and profile."
          />
        </div>
        <div className="border-t pt-4">
          <CoverImageUpload
            value={broker.coverImage}
            uploadUrl={`/api/admin/brokers/${broker.id}/cover-image`}
            removeUrl={`/api/admin/brokers/${broker.id}/cover-image`}
            mediaSelectUrl={`/api/admin/brokers/${broker.id}/cover-image/media`}
            onUploaded={() => router.refresh()}
            label="Cover image"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {(['displayName', 'companyName', 'phone', 'email', 'officeAddress', 'city', 'state', 'pinCode'] as const).map((field) => <label key={field} className="space-y-1"><span className="text-sm font-medium">{field}</span><input value={form[field] || ''} onChange={(event) => setForm({ ...form, [field]: event.target.value })} className="w-full rounded-lg border bg-background px-3 py-2" /></label>)}
          <label className="space-y-1"><span className="text-sm font-medium">NMLS ID</span><input value={form.nmls || ''} onChange={(event) => setForm({ ...form, nmls: event.target.value })} className="w-full rounded-lg border bg-background px-3 py-2" placeholder="12345678" /></label>
        </div>
        <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
          <div>
            <p className="text-sm font-medium">License States</p>
            <p className="text-sm text-muted-foreground">US states where this broker is licensed to originate mortgages.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {US_STATES.map((state) => {
              const selected = licenseStates.includes(state.code)
              return (
                <button
                  key={state.code}
                  type="button"
                  onClick={() => setLicenseStates((current) => selected ? current.filter((c) => c !== state.code) : [...current, state.code])}
                  aria-pressed={selected}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${selected ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:border-primary/40'}`}
                >
                  {state.code}
                </button>
              )
            })}
          </div>
        </div>
        <label className="block space-y-1"><span className="text-sm font-medium">Description</span><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="min-h-28 w-full rounded-lg border bg-background px-3 py-2" /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.verificationStatus === 'VERIFIED'} onChange={(event) => setForm({ ...form, verificationStatus: event.target.checked ? 'VERIFIED' : 'UNVERIFIED' })} /> Mark profile verified after review</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isVisible} onChange={(event) => setForm({ ...form, isVisible: event.target.checked })} /> Publish profile after review</label>
        <button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {saving ? 'Saving…' : 'Save profile'}
        </button>
      </form>
      <div className="space-y-4 rounded-xl border bg-card p-6">
        <div className="border-b pb-4"><h2 className="text-xl font-semibold">Location</h2><p className="mt-1 text-sm text-muted-foreground">Resolve the stored office address before enabling radius search.</p><button type="button" disabled={saving} onClick={resolveLocation} className="inline-flex items-center gap-2 rounded-lg border border-primary px-3 py-2 text-sm font-semibold text-primary disabled:opacity-50">{saving && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}Resolve Location</button></div>
        <h2 className="text-xl font-semibold">Claim readiness</h2>
        <p className="text-sm text-muted-foreground">The profile remains unowned. Sending an invitation does not complete ownership.</p>
        <label className="block space-y-1"><span className="text-sm font-medium">Invitation recipient</span><input type="email" value={deliveryEmail} onChange={(event) => setDeliveryEmail(event.target.value)} placeholder="Company delivery email" className="w-full rounded-lg border bg-background px-3 py-2" /></label>
        <div className="flex flex-wrap gap-2">
          <button disabled={isSending || !deliveryEmail} aria-busy={isSending} onClick={() => issueInvitation(activeInvitation ? `/api/admin/claim-invitations/${activeInvitation.id}/resend` : `/api/admin/brokers/${broker.id}/claim-invitations`)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {isSending ? 'Sending…' : activeInvitation ? 'Resend invitation' : 'Send invitation'}
          </button>
          {activeInvitation && <button disabled={isSending} onClick={() => revokeInvitation(activeInvitation.id)} className="rounded-lg border border-destructive px-3 py-2 text-sm text-destructive disabled:opacity-50">Revoke active</button>}
        </div>
        {claimLink && <button type="button" onClick={() => navigator.clipboard.writeText(claimLink).then(() => toast.success('Claim link copied.'))} className="rounded-lg border px-3 py-2 text-sm">Copy Claim Link</button>}
        {broker.claim?.invitations && broker.claim.invitations.length > 0 && <div className="space-y-2 border-t pt-4"><p className="text-sm font-medium">Invitation history</p>{broker.claim.invitations.map((item) => <div key={item.id} className="grid grid-cols-[1fr_auto] gap-2 text-xs text-muted-foreground"><span>{item.recipientEmail} · {item.status}</span><span>{new Date(item.createdAt).toLocaleString()}</span></div>)}</div>}
        <div className="mt-6 border-t border-destructive/30 pt-4">
          <p className="text-sm font-medium text-destructive">Danger zone</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Permanently deletes this broker profile, its claim history, subscription (cancelled
            first), messages, reviews, and — when the owner has no remaining account context — the
            associated user account.
          </p>
          <div className="mt-3">
            <DeleteAccountDialog
              triggerLabel="Delete broker"
              title="Delete this broker?"
              description="This permanently removes the broker profile and associated data. Any active subscription will be cancelled before deletion."
              endpoint={`/api/admin/brokers/${broker.id}/delete`}
              method="DELETE"
              onSuccess={() => router.push('/admin/brokers')}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
