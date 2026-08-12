'use client'

import { Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { getPlacementInfo, type PlacementKey } from './placementPreviews'
import { getPlacementSpec } from '@/lib/advertisements/placementSpecs'
import { getPlacementFormats, ADVERTISEMENT_FORMAT_INFO } from '@/lib/advertisements/formats'
import { cn } from '@/lib/utils'

export const PLACEMENT_CATEGORIES: Record<string, { label: string; values: string[] }> = {
  HOMEPAGE: { label: 'Homepage', values: ['HOMEPAGE_HERO', 'HOMEPAGE_SEARCH', 'HOMEPAGE_FEATURED', 'HOMEPAGE_SERVICES', 'HOMEPAGE_BANKS', 'HOMEPAGE_CTA'] },
  BROKER: { label: 'Broker Pages', values: ['BROKER_LISTING', 'BROKER_LISTING_LOCAL', 'BROKER_PROFILE_HEADER', 'BROKER_LISTING_SIDEBAR'] },
  FOOTER: { label: 'Footer', values: ['FOOTER'] },
  POPUP: { label: 'Popup', values: ['POPUP_OVERLAY'] },
  ANNOUNCEMENT: { label: 'Announcement', values: ['ANNOUNCEMENT_TOP', 'ANNOUNCEMENT_BOTTOM'] },
  MOBILE: { label: 'Mobile', values: ['MOBILE_HEADER_BANNER'] },
  OTHER: { label: 'Other', values: ['LOAN_CALCULATOR', 'BLOG_INLINE'] },
}

interface PlacementPickerProps {
  value: string | undefined
  onChange: (placement: string) => void
  className?: string
}

/**
 * Placement card grid. Every value (label, description, page, responsive
 * heights, supported formats) is read from the canonical placement sources:
 * `placementPreviews.ts`, `placementSpecs.ts`, and `formats.ts`. No height is
 * hardcoded here and no height is editable.
 */
export function PlacementPicker({ value, onChange, className }: PlacementPickerProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {Object.entries(PLACEMENT_CATEGORIES).map(([key, category]) => (
        <div key={key}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">{category.label}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {category.values.map((placement) => {
              const info = getPlacementInfo(placement as PlacementKey)
              const spec = getPlacementSpec(placement)
              const formats = getPlacementFormats(placement)
              const selected = value === placement
              const maxDesktop = info?.specs.maxDisplayHeight
              return (
                <button
                  key={placement}
                  type="button"
                  onClick={() => onChange(placement)}
                  aria-pressed={selected}
                  className={cn(
                    'group relative rounded-xl border p-4 text-left transition-all',
                    selected ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border hover:border-primary/40 hover:bg-muted/40',
                  )}
                >
                  {selected ? (
                    <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
                      <Check className="h-3 w-3" />
                    </span>
                  ) : null}
                  <div className="flex items-center gap-2 pr-7">
                    {info?.icon ? <info.icon className="h-4 w-4 shrink-0 text-primary" /> : null}
                    <p className="text-sm font-semibold">{info?.label || placement.replace(/_/g, ' ')}</p>
                  </div>
                  {info?.page ? <Badge variant="secondary" className="mt-2 text-[10px]">{info.page}</Badge> : null}
                  <p className="mt-1.5 text-xs text-text-muted">{info?.description || 'Advertisement placement'}</p>
                  {spec ? (
                    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-text-muted">
                      <span>Desktop {spec.display.desktop}px</span>
                      <span>·</span>
                      <span>Tablet {spec.display.tablet}px</span>
                      <span>·</span>
                      <span>Mobile {spec.display.mobile}px</span>
                      {maxDesktop ? <span className="font-medium text-primary">· Max {maxDesktop}px desktop</span> : null}
                    </div>
                  ) : null}
                  {formats.length > 0 ? (
                    <p className="mt-1.5 text-[11px] text-text-muted">
                      Formats: {formats.map((format) => ADVERTISEMENT_FORMAT_INFO[format].label).join(', ')}
                    </p>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
