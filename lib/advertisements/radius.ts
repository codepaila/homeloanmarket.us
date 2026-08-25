// Client-safe canonical radius bounds for advertisement location targeting.
// These MUST mirror the server-authoritative contract (lib/advertisements/
// validation.ts `radiusMiles: z.number().positive().max(100)` and
// lib/advertisements/services.ts create/update checks). The server remains the
// source of truth and re-validates every value; this module only drives the
// admin input control.
export const AD_RADIUS_MIN = 1
export const AD_RADIUS_MAX = 100
export const AD_RADIUS_DEFAULT = 25
export const AD_RADIUS_STEP = 1

export function clampAdRadius(value: number): number {
  if (!Number.isFinite(value)) return AD_RADIUS_DEFAULT
  return Math.min(AD_RADIUS_MAX, Math.max(AD_RADIUS_MIN, Math.round(value)))
}
