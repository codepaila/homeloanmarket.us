import type { AdvertisementFormat } from './formats'
import { PLACEMENT_FORMATS } from './formats'

export type FormatRequirement = {
  format: AdvertisementFormat
  width: number
  height: number
  aspectRatio: string
  mobile: { width: number; height: number; aspectRatio: string }
}

export type PlacementSpec = {
  placement: string
  formats: AdvertisementFormat[]
  display: { mobile: number; tablet: number; desktop: number }
  compact: boolean
  displayLabel: string
}

// Canonical responsive display heights for the full-width top banner strip.
// Desktop is capped at 150px; tablet and mobile scale down proportionally.
export const FULL_WIDTH_BANNER_DISPLAY = { mobile: 90, tablet: 120, desktop: 150 }

export const FORMAT_REQUIREMENTS: Record<AdvertisementFormat, FormatRequirement> = {
  HORIZONTAL: { format: 'HORIZONTAL', width: 1600, height: 300, aspectRatio: '16:3', mobile: { width: 750, height: 160, aspectRatio: '75:16' } },
  RECTANGLE: { format: 'RECTANGLE', width: 1200, height: 800, aspectRatio: '3:2', mobile: { width: 750, height: 500, aspectRatio: '3:2' } },
  SQUARE: { format: 'SQUARE', width: 800, height: 800, aspectRatio: '1:1', mobile: { width: 600, height: 600, aspectRatio: '1:1' } },
  VERTICAL: { format: 'VERTICAL', width: 800, height: 1200, aspectRatio: '2:3', mobile: { width: 600, height: 900, aspectRatio: '2:3' } },
  MOBILE: { format: 'MOBILE', width: 750, height: 320, aspectRatio: '75:32', mobile: { width: 750, height: 320, aspectRatio: '75:32' } },
  BANNER: { format: 'BANNER', width: 1600, height: 800, aspectRatio: '2:1', mobile: { width: 800, height: 400, aspectRatio: '2:1' } },
}

export const PLACEMENT_SIZE_SPECS: Record<string, PlacementSpec> = {
  HOMEPAGE_HERO: { placement: 'HOMEPAGE_HERO', formats: PLACEMENT_FORMATS.HOMEPAGE_HERO, display: { ...FULL_WIDTH_BANNER_DISPLAY }, compact: true, displayLabel: 'Compact full-width horizontal banner' },
  HOMEPAGE_SEARCH: { placement: 'HOMEPAGE_SEARCH', formats: PLACEMENT_FORMATS.HOMEPAGE_SEARCH, display: { ...FULL_WIDTH_BANNER_DISPLAY }, compact: true, displayLabel: 'Compact full-width horizontal banner' },
  HOMEPAGE_FEATURED: { placement: 'HOMEPAGE_FEATURED', formats: PLACEMENT_FORMATS.HOMEPAGE_FEATURED, display: { ...FULL_WIDTH_BANNER_DISPLAY }, compact: true, displayLabel: 'Compact full-width horizontal banner' },
  HOMEPAGE_SERVICES: { placement: 'HOMEPAGE_SERVICES', formats: PLACEMENT_FORMATS.HOMEPAGE_SERVICES, display: { ...FULL_WIDTH_BANNER_DISPLAY }, compact: true, displayLabel: 'Compact full-width horizontal banner' },
  HOMEPAGE_BANKS: { placement: 'HOMEPAGE_BANKS', formats: PLACEMENT_FORMATS.HOMEPAGE_BANKS, display: { ...FULL_WIDTH_BANNER_DISPLAY }, compact: true, displayLabel: 'Compact full-width banner' },
  HOMEPAGE_CTA: { placement: 'HOMEPAGE_CTA', formats: PLACEMENT_FORMATS.HOMEPAGE_CTA, display: { ...FULL_WIDTH_BANNER_DISPLAY }, compact: true, displayLabel: 'Compact full-width horizontal banner' },
  BROKER_LISTING: { placement: 'BROKER_LISTING', formats: PLACEMENT_FORMATS.BROKER_LISTING, display: { ...FULL_WIDTH_BANNER_DISPLAY }, compact: true, displayLabel: 'Compact full-width horizontal banner' },
  BROKER_LISTING_LOCAL: { placement: 'BROKER_LISTING_LOCAL', formats: PLACEMENT_FORMATS.BROKER_LISTING_LOCAL, display: { ...FULL_WIDTH_BANNER_DISPLAY }, compact: true, displayLabel: 'Related local resources banner' },
  BROKER_PROFILE_HEADER: { placement: 'BROKER_PROFILE_HEADER', formats: PLACEMENT_FORMATS.BROKER_PROFILE_HEADER, display: { ...FULL_WIDTH_BANNER_DISPLAY }, compact: true, displayLabel: 'Compact full-width horizontal banner' },
  BROKER_LISTING_SIDEBAR: { placement: 'BROKER_LISTING_SIDEBAR', formats: PLACEMENT_FORMATS.BROKER_LISTING_SIDEBAR, display: { mobile: 220, tablet: 240, desktop: 250 }, compact: true, displayLabel: 'Compact sidebar creative' },
  LOAN_CALCULATOR: { placement: 'LOAN_CALCULATOR', formats: PLACEMENT_FORMATS.LOAN_CALCULATOR, display: { ...FULL_WIDTH_BANNER_DISPLAY }, compact: true, displayLabel: 'Compact full-width horizontal banner' },
  BLOG_INLINE: { placement: 'BLOG_INLINE', formats: PLACEMENT_FORMATS.BLOG_INLINE, display: { ...FULL_WIDTH_BANNER_DISPLAY }, compact: true, displayLabel: 'Compact full-width editorial banner' },
  FOOTER: { placement: 'FOOTER', formats: PLACEMENT_FORMATS.FOOTER, display: { mobile: 60, tablet: 70, desktop: 80 }, compact: true, displayLabel: 'Ultra-short footer banner' },
  ANNOUNCEMENT_TOP: { placement: 'ANNOUNCEMENT_TOP', formats: PLACEMENT_FORMATS.ANNOUNCEMENT_TOP, display: { mobile: 50, tablet: 60, desktop: 70 }, compact: true, displayLabel: 'Ultra-short announcement banner' },
  ANNOUNCEMENT_BOTTOM: { placement: 'ANNOUNCEMENT_BOTTOM', formats: PLACEMENT_FORMATS.ANNOUNCEMENT_BOTTOM, display: { mobile: 50, tablet: 60, desktop: 70 }, compact: true, displayLabel: 'Ultra-short announcement banner' },
  POPUP_OVERLAY: { placement: 'POPUP_OVERLAY', formats: PLACEMENT_FORMATS.POPUP_OVERLAY, display: { mobile: 260, tablet: 290, desktop: 320 }, compact: true, displayLabel: 'Compact popup card' },
  MOBILE_HEADER_BANNER: { placement: 'MOBILE_HEADER_BANNER', formats: PLACEMENT_FORMATS.MOBILE_HEADER_BANNER, display: { mobile: 70, tablet: 80, desktop: 90 }, compact: true, displayLabel: 'Short mobile banner' },
}

export function getPlacementSpec(placement: string): PlacementSpec | undefined {
  return PLACEMENT_SIZE_SPECS[placement]
}

export function getFormatRequirement(format: AdvertisementFormat): FormatRequirement {
  return FORMAT_REQUIREMENTS[format]
}

export function getRequiredDimensions(placement: string, format: AdvertisementFormat, device: 'desktop' | 'mobile' = 'desktop'): { width: number; height: number; aspectRatio: string } {
  const requirement = FORMAT_REQUIREMENTS[format]
  if (device === 'mobile' || format === 'MOBILE') return requirement.mobile
  return requirement
}

export function getDisplayHeight(placement: string, device: 'desktop' | 'tablet' | 'mobile' = 'desktop'): number {
  const spec = getPlacementSpec(placement)
  if (spec) return spec.display[device]
  return 150
}

export type CreativeValidationResult =
  | { ok: true }
  | {
      ok: false
      requiredWidth: number
      requiredHeight: number
      requiredAspectRatio: string
      actualWidth: number
      actualHeight: number
      actualRatio: number
      reason: string
    }

// EXACT creative resolution contract. Creative requirements are exact pixel
// dimensions (e.g. SQUARE = 800 × 800). An image that is not exactly the
// required width and height is rejected — creatives are never resized or
// cropped to fit. This single function is shared by the admin UI (device
// upload, media library) and the backend (AdvertisementService), so the
// backend can never accept a creative the UI would reject.
export function validateCreativeDimensions(
  placement: string,
  format: AdvertisementFormat,
  width: number | null | undefined,
  height: number | null | undefined,
  device: 'desktop' | 'mobile' = 'desktop',
): CreativeValidationResult {
  const required = getRequiredDimensions(placement, format, device)
  if (!width || !height) {
    return {
      ok: false,
      requiredWidth: required.width,
      requiredHeight: required.height,
      requiredAspectRatio: required.aspectRatio,
      actualWidth: 0,
      actualHeight: 0,
      actualRatio: 0,
      reason: `Uploaded creative has no measurable dimensions. Required exactly ${required.width} × ${required.height} (${required.aspectRatio}).`,
    }
  }
  if (width !== required.width || height !== required.height) {
    return {
      ok: false,
      requiredWidth: required.width,
      requiredHeight: required.height,
      requiredAspectRatio: required.aspectRatio,
      actualWidth: width,
      actualHeight: height,
      actualRatio: width / height,
      reason: `This creative is ${width} × ${height} px but ${placement} requires exactly ${required.width} × ${required.height} px (${required.aspectRatio}).`,
    }
  }
  return { ok: true }
}
