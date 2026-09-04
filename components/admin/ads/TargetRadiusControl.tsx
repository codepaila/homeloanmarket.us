'use client'

import { AD_RADIUS_MIN, AD_RADIUS_MAX, AD_RADIUS_STEP, clampAdRadius } from '@/lib/advertisements/radius'

// Synchronized number-input + range-slider radius control. The number input and
// slider stay in sync; values are clamped to the canonical backend bounds on
// input and on blur. The server remains authoritative and re-validates.
export function TargetRadiusControl({
  value,
  onChange,
  locationLabel,
  id,
}: {
  value: number
  onChange: (value: number) => void
  locationLabel?: string
  id?: string
}) {
  const clamped = clampAdRadius(value)
  return (
    <div className="space-y-3">
      <div>
        <label htmlFor={id} className="text-sm font-medium">Target radius</label>
        <div className="mt-2 flex items-center gap-2">
          <input
            id={id}
            type="number"
            min={AD_RADIUS_MIN}
            max={AD_RADIUS_MAX}
            step={AD_RADIUS_STEP}
            value={clamped}
            onChange={(e) => onChange(e.target.value === '' ? AD_RADIUS_MIN : clampAdRadius(Number(e.target.value)))}
            onBlur={() => onChange(clampAdRadius(clamped))}
            aria-label="Target radius in miles"
            className="w-24 rounded border bg-background px-3 py-2 text-sm"
          />
          <span className="text-sm text-muted-foreground">miles</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">{AD_RADIUS_MIN} mi</span>
        <input
          type="range"
          min={AD_RADIUS_MIN}
          max={AD_RADIUS_MAX}
          step={AD_RADIUS_STEP}
          value={clamped}
          onChange={(e) => onChange(clampAdRadius(Number(e.target.value)))}
          aria-label="Target radius in miles slider"
          className="w-full accent-primary"
        />
        <span className="text-xs text-muted-foreground">{AD_RADIUS_MAX} mi</span>
      </div>
      <p className="text-sm font-medium text-primary">Target radius: {clamped} miles</p>
      <p className="text-xs text-muted-foreground">
        Ads can appear to brokers whose selected location is within {clamped} miles of this location.
        Minimum {AD_RADIUS_MIN} mile, maximum {AD_RADIUS_MAX} miles (validated server-side).
      </p>
      {locationLabel ? (
        <p className="text-xs text-muted-foreground">Targeting brokers within approximately {clamped} miles of {locationLabel}.</p>
      ) : null}
    </div>
  )
}
