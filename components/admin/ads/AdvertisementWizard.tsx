'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AdType, AdvertisementAction, ButtonVariant } from '@prisma/client'
import type { MediaAsset, AdvertisementOwner, AdvertisementRequestContext } from '@/lib/advertisements/types'
import type { AdvertisementFormat } from '@/lib/advertisements/formats'
import { getAdvertisementRequirements, getCreativeRequirementForFormat, getValidTypesForPlacement, getPlacementMeta, AD_TYPE_LABELS, ACTION_META } from '@/lib/advertisements/requirements'
import { PLACEMENT_SIZE_SPECS } from '@/lib/advertisements/placementSpecs'
import { AD_RADIUS_DEFAULT } from '@/lib/advertisements/radius'
import { AdvertisementCreativeUpload } from '@/components/admin/ads/AdvertisementCreativeUpload'
import { TargetRadiusControl } from '@/components/admin/ads/TargetRadiusControl'
import { OwnerSelector } from '@/components/admin/ads/OwnerSelector'
import { USLocationPicker } from '@/components/location/USLocationPicker'

type WizardState = {
  title: string
  description: string
  internalNotes: string
  owner: AdvertisementOwner
  placement: string | null
  type: AdType | null
  action: AdvertisementAction
  buttonLabel: string
  buttonUrl: string
  creativeFormat: AdvertisementFormat | null
  creatives: Record<string, MediaAsset | null> // key: format
  location?: { placeId?: string; normalizedAddress: string; city: string; state: string; zip: string; latitude: number; longitude: number } | null
  radiusMiles: number
  startDate: string
  endDate: string
  isEnabled: boolean
  isDismissible: boolean
  showMobile: boolean
}

const INITIAL_STATE: WizardState = {
  title: '',
  description: '',
  internalNotes: '',
  owner: { type: 'PLATFORM', companyId: null },
  placement: null,
  type: null,
  action: 'DISPLAY_ONLY',
  buttonLabel: '',
  buttonUrl: '',
  creativeFormat: null,
  creatives: {},
  location: null,
  radiusMiles: AD_RADIUS_DEFAULT,
  startDate: '',
  endDate: '',
  isEnabled: false,
  isDismissible: false,
  showMobile: true,
}

export function AdvertisementWizard({
  companyId,
  requestId,
  initialLocationTarget,
}: {
  companyId?: string
  requestId?: string
  initialLocationTarget?: { locationLabel?: string; city?: string; state?: string; zip?: string; googlePlaceId?: string; latitude?: number; longitude?: number; radiusMiles?: number }
}) {
  const router = useRouter()
  const [state, setState] = useState<WizardState>(() => ({
    ...INITIAL_STATE,
    ...(initialLocationTarget
      ? {
          location: initialLocationTarget.latitude && initialLocationTarget.longitude
            ? {
                placeId: initialLocationTarget.googlePlaceId,
                normalizedAddress: initialLocationTarget.locationLabel || '',
                city: initialLocationTarget.city || '',
                state: initialLocationTarget.state || '',
                zip: initialLocationTarget.zip || '',
                latitude: initialLocationTarget.latitude,
                longitude: initialLocationTarget.longitude,
              }
            : null,
          radiusMiles: initialLocationTarget.radiusMiles || AD_RADIUS_DEFAULT,
        }
      : {}),
  }))
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  // When creating from a company request, ownership is locked to the request's
  // company and the request relationship is managed server-side.
  const requestContext: AdvertisementRequestContext | undefined = useMemo(
    () => (requestId && companyId ? { requestId, companyId, locked: true } : undefined),
    [requestId, companyId],
  )

  const requirements = state.placement ? getAdvertisementRequirements(state.placement) : null
  const validTypes = state.placement ? getValidTypesForPlacement(state.placement) : []

  // Build the ordered step list, skipping irrelevant steps.
  const steps = useMemo(() => {
    const list: { key: string; label: string }[] = [{ key: 'basic', label: 'Details' }]
    if (!requestContext) list.push({ key: 'owner', label: 'Owner' })
    list.push({ key: 'placement', label: 'Placement' })
    if (state.placement) {
      if (validTypes.length > 1) list.push({ key: 'type', label: 'Type' })
      if (requirements?.supportsCta) list.push({ key: 'action', label: 'Action' })
      if (requirements && requirements.allowedFormats.length > 1) list.push({ key: 'format', label: 'Creative Format' })
      list.push({ key: 'creative', label: 'Creative' })
      if (requirements?.supportsLocation) list.push({ key: 'targeting', label: 'Targeting' })
      list.push({ key: 'schedule', label: 'Schedule' })
      list.push({ key: 'review', label: 'Review' })
    }
    return list
  }, [state.placement, requirements, validTypes.length, requestContext])

  const current = steps[step]

  function selectPlacement(placement: string) {
    const req = getAdvertisementRequirements(placement)
    setState((prev) => ({
      ...prev,
      placement,
      type: req.recommendedType,
      action: req.supportsCta ? prev.action : 'DISPLAY_ONLY',
      showMobile: req.supportsMobile,
      creativeFormat: req.allowedFormats.length === 1 ? req.allowedFormats[0] : null,
      creatives: {},
    }))
  }

  function set<K extends keyof WizardState>(key: K, value: WizardState[K]) {
    setState((prev) => ({ ...prev, [key]: value }))
  }

  const needsButton = state.action !== 'DISPLAY_ONLY' && state.action !== 'BANNER_CLICK'
  const needsUrl = state.action !== 'DISPLAY_ONLY'

  function buildPayload() {
    const mediaAssetId = state.creativeFormat ? state.creatives[state.creativeFormat]?.id : undefined
    const creativeAssignments = mediaAssetId && state.creativeFormat
      ? [{ mediaAssetId, format: state.creativeFormat }]
      : []
    const desktopAssignment = creativeAssignments.find((a) => a.format !== 'MOBILE')?.mediaAssetId || creativeAssignments[0]?.mediaAssetId || ''
    const mobileAssignment = creativeAssignments.find((a) => a.format === 'MOBILE')?.mediaAssetId || desktopAssignment
    const effectiveCompanyId = requestContext
      ? requestContext.companyId
      : (state.owner.type === 'COMPANY' ? state.owner.companyId : null)
    return {
      title: state.title.trim() || undefined,
      description: state.description || undefined,
      internalNotes: state.internalNotes || undefined,
      placement: state.placement,
      type: state.type,
      action: state.action,
      buttonVariant: 'PRIMARY' as ButtonVariant,
      buttonLabel: needsButton ? state.buttonLabel || undefined : undefined,
      buttonUrl: needsUrl ? state.buttonUrl || undefined : undefined,
      bannerUrl: undefined,
      desktopMediaId: desktopAssignment || undefined,
      mobileMediaId: mobileAssignment || undefined,
      displayOrder: 0,
      priority: 10,
      startDate: state.startDate ? new Date(state.startDate) : undefined,
      endDate: state.endDate ? new Date(state.endDate) : undefined,
      isEnabled: state.isEnabled,
      isArchived: false,
      showDesktop: true,
      showTablet: true,
      showMobile: state.showMobile,
      isDismissible: state.isDismissible,
      locationTarget: requirements?.supportsLocation && state.location
        ? {
            locationLabel: state.location.normalizedAddress,
            countryCode: 'US' as const,
            city: state.location.city || undefined,
            state: state.location.state || undefined,
            zip: state.location.zip || undefined,
            googlePlaceId: state.location.placeId || undefined,
            latitude: state.location.latitude,
            longitude: state.location.longitude,
            radiusMiles: state.radiusMiles,
          }
        : undefined,
      creativeAssignments,
      companyId: effectiveCompanyId || undefined,
      requestId: requestContext?.requestId,
    }
  }

  async function submit() {
    if (submitting) return
    const missing: string[] = []
    if (!state.placement) missing.push('Placement')
    if (!state.type) missing.push('Advertisement type')
    if (state.creativeFormat && !state.creatives[state.creativeFormat]) {
      const formatReq = state.placement ? getCreativeRequirementForFormat(state.placement, state.creativeFormat) : null
      missing.push(formatReq ? `${formatReq.label} image (${formatReq.width} × ${formatReq.height})` : 'Creative image')
    }
    if (requirements?.supportsLocation && !state.location) missing.push('Location target')
    if (needsUrl && !state.buttonUrl.trim()) missing.push('Destination URL')
    if (missing.length) {
      toast.error(`Please complete the required fields: ${missing.join(', ')}.`)
      return
    }
    setSubmitting(true)
    try {
      const response = await fetch('/api/admin/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to create advertisement')
      // Request linking + FULFILLED is handled server-side atomically.
      toast.success(requestContext ? 'Advertisement created and request fulfilled successfully.' : 'Advertisement created successfully.')
      router.push('/admin/ads/list')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to create advertisement. Please check the required fields.')
    } finally {
      setSubmitting(false)
    }
  }

  function canContinue(): boolean {
    if (current.key === 'basic') return true
    if (current.key === 'owner') {
      if (state.owner.type === 'COMPANY' && !state.owner.companyId) return false
      return true
    }
    if (current.key === 'placement') return Boolean(state.placement)
    if (current.key === 'type') return Boolean(state.type)
    if (current.key === 'action') return !needsUrl || state.buttonUrl.trim().length > 0
    if (current.key === 'format') return Boolean(state.creativeFormat)
    if (current.key === 'creative') {
      if (!state.creativeFormat) return false
      return Boolean(state.creatives[state.creativeFormat])
    }
    if (current.key === 'targeting') return Boolean(state.location)
    return true
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <ol aria-label="Advertisement creation steps" className="flex flex-wrap items-center gap-2 text-xs">
        {steps.map((s, index) => (
          <li key={s.key} className="flex items-center gap-2">
            <span
              aria-current={index === step ? 'step' : undefined}
              className={cn('flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ring-1 ring-inset', index === step ? 'bg-primary text-primary-foreground ring-primary' : index < step ? 'bg-emerald-100 text-emerald-700 ring-emerald-200' : 'bg-muted text-muted-foreground ring-border')}
            >
              {index < step ? <Check className="h-3 w-3" /> : null}{s.label}
            </span>
            {index < steps.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
          </li>
        ))}
      </ol>

      {/* Step content */}
      {current.key === 'basic' && (
        <section className="space-y-4 rounded border bg-card p-5">
          <h2 className="text-lg font-semibold">Basic Details</h2>
          <label className="block space-y-1"><span className="text-sm font-medium">Advertisement title</span><input value={state.title} onChange={(e) => set('title', e.target.value)} className="w-full rounded border bg-background px-3 py-2 text-sm" /></label>
          <label className="block space-y-1"><span className="text-sm font-medium">Description</span><textarea value={state.description} onChange={(e) => set('description', e.target.value)} rows={3} className="w-full rounded border bg-background px-3 py-2 text-sm" /></label>
          <label className="block space-y-1"><span className="text-sm font-medium">Internal notes</span><textarea value={state.internalNotes} onChange={(e) => set('internalNotes', e.target.value)} rows={2} className="w-full rounded border bg-background px-3 py-2 text-sm" /></label>
        </section>
      )}

      {current.key === 'owner' && (
        <section className="rounded border bg-card p-5">
          <OwnerSelector
            value={state.owner}
            onChange={(owner) => set('owner', owner)}
          />
        </section>
      )}

      {current.key === 'placement' && (
        <section className="space-y-4 rounded border bg-card p-5">
          <h2 className="text-lg font-semibold">Placement</h2>
          <p className="text-sm text-muted-foreground">Where should this advertisement appear?</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.keys(PLACEMENT_SIZE_SPECS).map((placement) => {
              const meta = getPlacementMeta(placement)
              const selected = state.placement === placement
              return (
                <button key={placement} type="button" onClick={() => selectPlacement(placement)} className={cn('rounded border p-4 text-left transition-colors', selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:border-primary/50')}>
                  <p className="font-semibold">{meta?.label || placement}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{meta?.description}</p>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {current.key === 'type' && (
        <section className="space-y-4 rounded border bg-card p-5">
          <h2 className="text-lg font-semibold">Advertisement Type</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {validTypes.map((type) => (
              <button key={type} type="button" onClick={() => set('type', type)} className={cn('rounded border p-4 text-left', state.type === type ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:border-primary/50')}>
                <span className="font-medium">{AD_TYPE_LABELS[type]}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {current.key === 'action' && (
        <section className="space-y-4 rounded border bg-card p-5">
          <h2 className="text-lg font-semibold">Action / Display Behavior</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {(Object.keys(ACTION_META) as AdvertisementAction[]).map((action) => (
              <button key={action} type="button" onClick={() => set('action', action)} className={cn('rounded border p-4 text-left', state.action === action ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:border-primary/50')}>
                <span className="font-medium">{ACTION_META[action].label}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{ACTION_META[action].description}</span>
              </button>
            ))}
          </div>
          {needsUrl && (
            <div className="space-y-3 border-t pt-4">
              <label className="block space-y-1"><span className="text-sm font-medium">Destination URL *</span><input value={state.buttonUrl} onChange={(e) => set('buttonUrl', e.target.value)} placeholder="https://example.com" className="w-full rounded border bg-background px-3 py-2 text-sm" /></label>
              {needsButton && (
                <label className="block space-y-1"><span className="text-sm font-medium">Button label</span><input value={state.buttonLabel} onChange={(e) => set('buttonLabel', e.target.value)} placeholder="Learn more" className="w-full rounded border bg-background px-3 py-2 text-sm" /></label>
              )}
            </div>
          )}
        </section>
      )}

      {current.key === 'format' && requirements && (
        <section className="space-y-4 rounded border bg-card p-5">
          <h2 className="text-lg font-semibold">Creative Format</h2>
          <p className="text-sm text-muted-foreground">The {requirements.label} placement supports multiple creative sizes. Pick the size you want to provide.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {requirements.allowedFormats.map((format) => {
              const formatReq = getCreativeRequirementForFormat(state.placement!, format)
              const selected = state.creativeFormat === format
              return (
                <button key={format} type="button" onClick={() => set('creativeFormat', format)} className={cn('rounded border p-4 text-left transition-colors', selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:border-primary/50')}>
                  <span className="font-medium">{formatReq.label}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{formatReq.width} × {formatReq.height}</span>
                  <span className="block text-xs text-muted-foreground">Aspect ratio: {formatReq.aspectRatio}</span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {current.key === 'creative' && (() => {
        if (!requirements || !state.placement || !state.creativeFormat) return null
        const format = state.creativeFormat
        const formatReq = getCreativeRequirementForFormat(state.placement, format)
        return (
          <section className="space-y-5 rounded border bg-card p-5">
            <h2 className="text-lg font-semibold">Creative</h2>
            <p className="text-sm text-muted-foreground">Provide the image required by the {requirements.label} placement.</p>
            <AdvertisementCreativeUpload
              requirement={formatReq}
              placement={state.placement}
              value={state.creatives[format]}
              onChange={(asset) => set('creatives', { ...state.creatives, [format]: asset })}
            />
          </section>
        )
      })()}

      {current.key === 'targeting' && requirements?.supportsLocation && (
        <section className="space-y-4 rounded border bg-card p-5">
          <h2 className="text-lg font-semibold">Location Targeting</h2>
          <p className="text-sm text-muted-foreground">Where should this advertisement appear?</p>
          <USLocationPicker value={state.location || undefined} onChange={(location) => set('location', location || null)} />
          <TargetRadiusControl
            value={state.radiusMiles}
            onChange={(radiusMiles) => set('radiusMiles', radiusMiles)}
            locationLabel={state.location ? (state.location.normalizedAddress || `${state.location.city}, ${state.location.state}`) : undefined}
          />
        </section>
      )}

      {current.key === 'schedule' && (
        <section className="space-y-4 rounded border bg-card p-5">
          <h2 className="text-lg font-semibold">Display &amp; Schedule</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={state.isEnabled} onChange={(e) => set('isEnabled', e.target.checked)} /> Enabled</label>
            {state.placement === 'ANNOUNCEMENT_TOP' || state.placement === 'ANNOUNCEMENT_BOTTOM' || state.placement === 'POPUP_OVERLAY' ? (
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={state.isDismissible} onChange={(e) => set('isDismissible', e.target.checked)} /> Dismissible</label>
            ) : null}
          </div>
          {requirements?.supportsMobile && (
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={state.showMobile} onChange={(e) => set('showMobile', e.target.checked)} /> Show on mobile</label>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1"><span className="text-sm font-medium">Start date</span><input type="date" value={state.startDate} onChange={(e) => set('startDate', e.target.value)} className="w-full rounded border bg-background px-3 py-2 text-sm" /></label>
            <label className="block space-y-1"><span className="text-sm font-medium">End date</span><input type="date" value={state.endDate} onChange={(e) => set('endDate', e.target.value)} className="w-full rounded border bg-background px-3 py-2 text-sm" /></label>
          </div>
        </section>
      )}

      {current.key === 'review' && (
        <section className="space-y-4 rounded border bg-card p-5">
          <h2 className="text-lg font-semibold">Review Advertisement</h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-muted-foreground">Title</dt><dd className="font-medium">{state.title.trim() || 'Not provided'}</dd></div>
            {requirements && <div><dt className="text-muted-foreground">Placement</dt><dd className="font-medium">{requirements.label}</dd></div>}
            {state.type && <div><dt className="text-muted-foreground">Type</dt><dd>{AD_TYPE_LABELS[state.type]}</dd></div>}
            <div><dt className="text-muted-foreground">Action</dt><dd>{ACTION_META[state.action]?.label || state.action}</dd></div>
            {needsUrl && <div><dt className="text-muted-foreground">Destination</dt><dd className="break-all">{state.buttonUrl || '—'}</dd></div>}
            {requirements?.supportsLocation && state.location && (
              <div><dt className="text-muted-foreground">Target</dt><dd>{state.location.normalizedAddress || `${state.location.city}, ${state.location.state}`} · {state.radiusMiles} miles</dd></div>
            )}
            <div><dt className="text-muted-foreground">Schedule</dt><dd>{state.startDate ? new Date(state.startDate).toLocaleDateString() : '—'} → {state.endDate ? new Date(state.endDate).toLocaleDateString() : '—'}</dd></div>
            <div><dt className="text-muted-foreground">Status</dt><dd>{state.isEnabled ? 'Enabled' : 'Disabled'}</dd></div>
          </dl>
          {state.creativeFormat && state.placement && (() => {
            const formatReq = getCreativeRequirementForFormat(state.placement, state.creativeFormat)
            const asset = state.creatives[state.creativeFormat]
            return (
              <div className="space-y-3">
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div><dt className="text-muted-foreground">Creative format</dt><dd className="font-medium">{formatReq.label}</dd></div>
                  <div><dt className="text-muted-foreground">Required resolution</dt><dd>{formatReq.width} × {formatReq.height} px · {formatReq.aspectRatio}</dd></div>
                  <div><dt className="text-muted-foreground">Uploaded resolution</dt><dd>{asset?.width && asset?.height ? `${asset.width} × ${asset.height} px` : '—'}</dd></div>
                  <div><dt className="text-muted-foreground">Media file</dt><dd className="break-all">{asset?.fileName || '—'}</dd></div>
                </div>
                <div className="flex items-center gap-3 rounded border bg-muted/40 p-3">
                  {asset?.fileUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={asset.fileUrl} alt={formatReq.label} className="h-16 w-24 shrink-0 rounded object-cover" />
                  ) : (
                    <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded bg-muted text-xs text-muted-foreground">No image</div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{asset?.fileName || formatReq.label}</p>
                    <p className="text-xs text-muted-foreground">Uploaded {asset?.width} × {asset?.height} px · Required {formatReq.width} × {formatReq.height} px</p>
                  </div>
                </div>
              </div>
            )
          })()}
          {(requestContext || state.owner.type === 'COMPANY') && (
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Owner</dt>
                <dd className="font-medium">
                  {requestContext
                    ? (requestContext.companyId ? 'Company-owned (from request)' : '—')
                    : state.owner.type === 'COMPANY' ? 'Specific Company' : 'Platform / No Company'}
                </dd>
              </div>
              {requestContext && (
                <div><dt className="text-muted-foreground">Request</dt><dd className="break-all">REQUEST-{requestContext.requestId.slice(-8).toUpperCase()}</dd></div>
              )}
            </dl>
          )}
        </section>
      )}

      {/* Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <button type="button" onClick={() => step > 0 && setStep(step - 1)} disabled={step === 0} className="inline-flex items-center gap-2 rounded border px-4 py-2 text-sm font-semibold disabled:opacity-50">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        {current.key === 'review' ? (
          <button type="button" onClick={submit} disabled={submitting} className="inline-flex items-center gap-2 rounded bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {submitting ? 'Creating…' : 'Create Advertisement'}
          </button>
        ) : (
          <button type="button" onClick={() => canContinue() && setStep(step + 1)} disabled={!canContinue()} className="inline-flex items-center gap-2 rounded bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {current.key === 'placement' ? 'Continue to Configuration' : 'Continue'} <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}
