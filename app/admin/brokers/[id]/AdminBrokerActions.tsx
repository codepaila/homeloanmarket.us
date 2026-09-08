'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { Loader2, ShieldCheck, MapPin, Link2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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
  userId?: string | null
  isVisible: boolean
  verificationStatus: string
  verifiedAt?: string | Date | null
  creationSource?: string | null
  brokerStatus?: string
  normalizedAddress?: string | null
  logo?: string | null
  coverImage?: string | null
  profileImage?: string | null
  claim?: { invitations: AdminInvitation[] } | null
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  )
}

const inputClass = 'w-full rounded border bg-background px-3 py-2 text-sm'

export default function AdminBrokerActions({ broker }: { broker: AdminBroker }) {
  const router = useRouter()
  const [deliveryEmail, setDeliveryEmail] = useState(broker.claim?.invitations?.find((item) => item.status === 'ACTIVE')?.recipientEmail || broker.email || '')
  const [claimLink, setClaimLink] = useState('')
  const [saving, setSaving] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verificationStatus, setVerificationStatus] = useState(broker.verificationStatus)
  const [verifiedAt, setVerifiedAt] = useState<string | null>(broker.verifiedAt ? new Date(broker.verifiedAt).toISOString() : null)
  const [isVisible, setIsVisible] = useState(broker.isVisible)
  const [form, setForm] = useState({
    displayName: broker.displayName,
    companyName: broker.companyName || '',
    description: broker.description,
    phone: broker.phone,
    email: broker.email || '',
    officeAddress: broker.officeAddress,
    city: broker.city || '',
    state: broker.state || '',
    pinCode: broker.pinCode || '',
    nmls: broker.nmls || '',
  })
  const [licenseStates, setLicenseStates] = useState<string[]>(broker.licenseStates || [])

  const isVerified = verificationStatus === 'VERIFIED'
  const isSelfRegistered = broker.creationSource === 'SELF_REGISTERED'
  const isSuspended = broker.brokerStatus === 'SUSPENDED'
  const sourceLabel = broker.creationSource === 'SELF_REGISTERED' ? 'Self Registered' : broker.creationSource === 'ADMIN_CREATED' ? 'Admin Created' : 'Unclassified'
  const activeInvitation = broker.claim?.invitations?.find((item) => item.status === 'ACTIVE')

  async function updateProfile(event: React.FormEvent) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      const response = await fetch(`/api/admin/brokers/${broker.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, licenseStates }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to update broker profile. Please try again.')
      setVerificationStatus(data.broker.verificationStatus)
      setVerifiedAt(data.broker.verifiedAt ? new Date(data.broker.verifiedAt).toISOString() : null)
      setIsVisible(data.broker.isVisible)
      toast.success('Broker profile updated successfully.')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update broker profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function verifyBroker() {
    if (verifying || isVerified) return
    setVerifying(true)
    try {
      // Reuse the existing admin broker PATCH endpoint; the backend (Phase 8.36.1
      // lib/broker-verification.ts) enforces ADMIN-only, sets verifiedAt, and
      // sends the "Account Verified" email only on the UNVERIFIED -> VERIFIED
      // transition. Only the canonical verification field is sent.
      const response = await fetch(`/api/admin/brokers/${broker.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificationStatus: 'VERIFIED' }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to verify broker. Please try again.')
      setVerificationStatus('VERIFIED')
      setVerifiedAt(data.broker.verifiedAt ? new Date(data.broker.verifiedAt).toISOString() : new Date().toISOString())
      toast.success('Broker verified successfully.')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to verify broker. Please try again.')
    } finally {
      setVerifying(false)
    }
  }

  async function updateVisibility(next: boolean) {
    if (saving) return
    setSaving(true)
    try {
      // Publication is an independent control that reuses the existing admin
      // broker PATCH endpoint; it never touches verification.
      const response = await fetch(`/api/admin/brokers/${broker.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isVisible: next }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to update publication status. Please try again.')
      setIsVisible(data.broker.isVisible)
      toast.success(data.broker.isVisible ? 'Profile published.' : 'Profile unpublished.')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update publication status. Please try again.')
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

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1.4fr_0.8fr]">
      {/* ================= MAIN: PROFILE EDIT FORM ================= */}
      <form onSubmit={updateProfile} className="space-y-6 rounded border bg-card p-6">
        <h2 className="text-lg font-semibold">Profile details</h2>

        {/* Media */}
        <div className="grid ">
          <ProfileImageUpload
            value={broker.profileImage}
            uploadUrl={`/api/admin/brokers/${broker.id}/profile-image`}
            removeUrl={`/api/admin/brokers/${broker.id}/profile-image`}
            label="Profile image"
            helperText="Professional broker photo shown on public cards and profile."
          />
          {/* <CoverImageUpload
            value={broker.coverImage}
            uploadUrl={`/api/admin/brokers/${broker.id}/cover-image`}
            removeUrl={`/api/admin/brokers/${broker.id}/cover-image`}
            mediaSelectUrl={`/api/admin/brokers/${broker.id}/cover-image/media`}
            onUploaded={() => router.refresh()}
            label="Cover image"
          /> */}
        </div>

        {/* Identity */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Identity</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Display name"><input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} className={inputClass} /></Field>
            <Field label="Company name"><input value={form.companyName} onChange={(event) => setForm({ ...form, companyName: event.target.value })} className={inputClass} /></Field>
          </div>
        </div>

        {/* Contact */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Contact</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone"><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className={inputClass} /></Field>
            <Field label="Email"><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className={inputClass} /></Field>
          </div>
        </div>

        {/* Office location */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Office location</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Office address"><input value={form.officeAddress} onChange={(event) => setForm({ ...form, officeAddress: event.target.value })} className={inputClass} /></Field>
            <Field label="City"><input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} className={inputClass} /></Field>
            <Field label="State"><input value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value })} className={inputClass} /></Field>
            <Field label="ZIP / PIN"><input value={form.pinCode} onChange={(event) => setForm({ ...form, pinCode: event.target.value })} className={inputClass} /></Field>
          </div>
        </div>

        {/* Professional */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Professional</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="NMLS ID"><input value={form.nmls || ''} onChange={(event) => setForm({ ...form, nmls: event.target.value })} className={inputClass} placeholder="12345678" /></Field>
            <div>
              <span className="text-sm font-medium">License states</span>
              <p className="text-xs text-muted-foreground">US states where this broker is licensed to originate mortgages.</p>
              <div className="mt-2 flex flex-wrap gap-2">
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
          </div>
        </div>

        {/* Public profile */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Public profile</h3>
          <Field label="Description"><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="min-h-28 w-full rounded border bg-background px-3 py-2 text-sm" /></Field>
        </div>

        <div className="flex justify-end border-t pt-4">
          <button disabled={saving} className="inline-flex items-center gap-2 rounded bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>

      {/* ================= SIDEBAR: ADMINISTRATION ================= */}
      <div className="space-y-4">
        {/* Verification */}
        <section className="space-y-3 rounded border bg-card p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className={`h-4 w-4 ${isVerified ? 'text-success' : 'text-warning'}`} aria-hidden="true" />
            <h2 className="text-sm font-semibold">Verification</h2>
            <Badge variant={isVerified ? 'default' : 'outline'} className={isVerified ? 'bg-success/10 text-success' : ''}>
              {isVerified ? 'Verified' : 'Under Review'}
            </Badge>
          </div>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Source</dt><dd className="font-medium">{sourceLabel}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Verified At</dt><dd className="font-medium">{verifiedAt ? new Date(verifiedAt).toLocaleString() : '—'}</dd></div>
            {isSuspended && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Account Status</dt><dd className="font-medium text-destructive">Suspended</dd></div>}
          </dl>
          <p className="text-sm text-muted-foreground">
            Verification approves a self-registered broker so their profile can appear in the public
            directory. It does not change publication (isVisible), account status, or subscription.
          </p>
          {isSelfRegistered && !isVerified && (
            <button
              type="button"
              disabled={verifying || saving}
              onClick={verifyBroker}
              className="inline-flex items-center gap-2 rounded bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {verifying && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {verifying ? 'Verifying…' : 'Verify Broker'}
            </button>
          )}
        </section>

        {/* Publication */}
        <section className="space-y-3 rounded border bg-card p-5">
          <h2 className="text-sm font-semibold">Publication</h2>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{isVisible ? 'Published' : 'Unpublished'}</p>
              <p className="text-xs text-muted-foreground">Controls whether this broker profile is publicly listed.</p>
            </div>
            <input
              type="checkbox"
              checked={isVisible}
              aria-label="Publish profile"
              disabled={saving}
              onChange={(event) => void updateVisibility(event.target.checked)}
              className="h-4 w-4"
            />
          </div>
          <p className="text-xs text-muted-foreground">Publication is independent of verification, account status, and subscription.</p>
        </section>

        {/* Location */}
        <section className="space-y-3 rounded border bg-card p-5">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-sm font-semibold">Location</h2>
          </div>
          {broker.normalizedAddress ? (
            <p className="text-sm text-muted-foreground">Address available: <span className="font-medium text-foreground">{broker.normalizedAddress}</span></p>
          ) : (
            <p className="text-sm text-muted-foreground">Location needs to be resolved before radius search.</p>
          )}
          <button type="button" disabled={saving} onClick={resolveLocation} className="inline-flex items-center gap-2 rounded border border-primary px-3 py-2 text-sm font-semibold text-primary disabled:opacity-50">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            Resolve Location
          </button>
        </section>

        {/* Ownership / Claim readiness */}
        <section className="space-y-3 rounded border bg-card p-5">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-sm font-semibold">Ownership</h2>
            <Badge variant={broker.userId ? 'default' : 'outline'}>{broker.userId ? 'Owned' : 'Unowned'}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">The profile remains unowned. Sending an invitation does not complete ownership.</p>
          <Field label="Invitation recipient"><input type="email" value={deliveryEmail} onChange={(event) => setDeliveryEmail(event.target.value)} placeholder="Company delivery email" className={inputClass} /></Field>
          <div className="flex flex-wrap gap-2">
            <button disabled={isSending || !deliveryEmail} aria-busy={isSending} onClick={() => issueInvitation(activeInvitation ? `/api/admin/claim-invitations/${activeInvitation.id}/resend` : `/api/admin/brokers/${broker.id}/claim-invitations`)} className="inline-flex items-center gap-2 rounded bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {isSending ? 'Sending…' : activeInvitation ? 'Resend invitation' : 'Send invitation'}
            </button>
            {activeInvitation && <button disabled={isSending} onClick={() => revokeInvitation(activeInvitation.id)} className="rounded border border-destructive px-3 py-2 text-sm text-destructive disabled:opacity-50">Revoke active</button>}
          </div>
          {claimLink && <button type="button" onClick={() => navigator.clipboard.writeText(claimLink).then(() => toast.success('Claim link copied.'))} className="rounded border px-3 py-2 text-sm">Copy Claim Link</button>}
          {broker.claim?.invitations && broker.claim.invitations.length > 0 && (
            <div className="space-y-2 border-t pt-3">
              <p className="text-sm font-medium">Invitation history</p>
              {broker.claim.invitations.map((item) => (
                <div key={item.id} className="grid grid-cols-[1fr_auto] gap-2 text-xs text-muted-foreground">
                  <span>{item.recipientEmail} · {item.status}</span>
                  <span>{new Date(item.createdAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Danger zone */}
        <section className="space-y-3 rounded border border-destructive/30 bg-card p-5">
          <h2 className="text-sm font-semibold text-destructive">Danger zone</h2>
          <p className="text-xs text-muted-foreground">
            Permanently deletes this broker profile, its claim history, subscription (cancelled
            first), messages, reviews, and — when the owner has no remaining account context — the
            associated user account.
          </p>
          <DeleteAccountDialog
            triggerLabel="Delete broker"
            title="Delete this broker?"
            description="This permanently removes the broker profile and associated data. Any active subscription will be cancelled before deletion."
            endpoint={`/api/admin/brokers/${broker.id}/delete`}
            method="DELETE"
            onSuccess={() => router.push('/admin/brokers')}
          />
        </section>
      </div>
    </div>
  )
}