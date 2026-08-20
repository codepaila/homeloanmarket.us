'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { Loader2, BadgeCheck, ShieldCheck } from 'lucide-react'
import { isMortgageExpertBroker } from '@/lib/broker-policy'

type SubscriptionState = {
  plan: string
  isActive: boolean
  startDate?: string | Date | null
  endDate?: string | Date | null
}

type MortgageExpertControlProps = {
  brokerId: string
  mortgageExpertEnabled: boolean
  // PROFILE_BADGE entitlement resolved server-side from the broker's active
  // plan feature configuration.
  profileBadge: boolean
  subscription: SubscriptionState | null
}

function qualificationSource(profileBadge: boolean, adminEnabled: boolean) {
  if (profileBadge && adminEnabled) return 'Plan feature + Admin enabled'
  if (profileBadge) return 'Plan PROFILE_BADGE feature'
  if (adminEnabled) return 'Admin enabled'
  return 'Not qualified'
}

export default function MortgageExpertControl({
  brokerId,
  mortgageExpertEnabled,
  profileBadge,
}: MortgageExpertControlProps) {
  const router = useRouter()
  const [enabled, setEnabled] = useState(mortgageExpertEnabled)
  const [saving, setSaving] = useState(false)

  const effective = isMortgageExpertBroker({
    mortgageExpertEnabled: enabled,
    profileBadge,
  })

  async function toggleBadge(next: boolean) {
    if (saving) return
    setSaving(true)
    try {
      const response = await fetch(`/api/admin/brokers/${brokerId}/mortgage-expert`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      })
      const data = await response.json()
      if (!response.ok) {
        toast.error(data.message || 'Unable to update the Mortgage Expert badge.')
        return
      }
      setEnabled(data.mortgageExpertEnabled === true)
      toast.success(next ? 'Mortgage Expert badge enabled successfully.' : 'Mortgage Expert badge disabled successfully.')
      router.refresh()
    } catch {
      toast.error('Unable to update the Mortgage Expert badge.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-xl border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Mortgage Expert</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {effective ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-primary">
                <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                Status: Enabled
              </span>
            ) : (
              'Status: Disabled'
            )}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Qualification source: <span className="font-medium">{qualificationSource(profileBadge, enabled)}</span>
          </p>
        </div>
        {effective && (
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">Mortgage Expert</span>
        )}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border p-4">
          <h3 className="text-sm font-semibold">Subscription qualification</h3>
          <p className="mt-1 text-sm text-muted-foreground">PROFILE_BADGE plan feature</p>
          {profileBadge ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Automatically qualified
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Not granted by current plan</p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Plan feature grants are managed from the broker plan configuration. This cannot be changed from the badge controls.
          </p>
        </div>

        <div className="rounded-lg border p-4">
          <h3 className="text-sm font-semibold">Admin badge</h3>
          <p className="mt-1 text-sm text-muted-foreground">Mortgage Expert badge</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={saving || enabled}
              aria-busy={saving}
              onClick={() => void toggleBadge(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {saving ? 'Saving...' : 'Enable badge'}
            </button>
            <button
              type="button"
              disabled={saving || !enabled}
              aria-busy={saving}
              onClick={() => void toggleBadge(false)}
              className="inline-flex items-center gap-2 rounded-lg border border-destructive px-4 py-2 text-sm font-semibold text-destructive disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {saving ? 'Saving...' : 'Disable badge'}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Independent of the broker&apos;s subscription, profile, and status.
          </p>
        </div>
      </div>
    </section>
  )
}
