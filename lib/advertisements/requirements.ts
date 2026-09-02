import type { AdType } from '@prisma/client'
import type { AdvertisementFormat } from './formats'
import { getPlacementFormats } from './formats'
import { getFormatRequirement } from './placementSpecs'

// Shared placement metadata for the admin UI. This is a UI concern only — the
// canonical advertisement engine reads placement/enum values from the database
// and the placement specs in ./placementSpecs.ts.
export const PLACEMENT_META: Record<string, { label: string; description: string; recommendedType: AdType }> = {
  HOMEPAGE_HERO: { label: 'Homepage — Hero', description: 'Large banner at the top of the homepage.', recommendedType: 'HERO_BANNER' },
  HOMEPAGE_SEARCH: { label: 'Homepage — Search', description: 'Banner near the homepage search tool.', recommendedType: 'INLINE_BANNER' },
  HOMEPAGE_FEATURED: { label: 'Homepage — Featured', description: 'Banner in the featured section.', recommendedType: 'SECTION_BANNER' },
  HOMEPAGE_SERVICES: { label: 'Homepage — Services', description: 'Banner in the services section.', recommendedType: 'SECTION_BANNER' },
  HOMEPAGE_BANKS: { label: 'Homepage — Banks', description: 'Banner in the banks section.', recommendedType: 'SECTION_BANNER' },
  HOMEPAGE_CTA: { label: 'Homepage — Call to Action', description: 'Banner in the homepage call-to-action.', recommendedType: 'SECTION_BANNER' },
  BROKER_LISTING: { label: 'Broker Listing — Global', description: 'Displays on the broker listing page without location-specific targeting.', recommendedType: 'SECTION_BANNER' },
  BROKER_LISTING_LOCAL: { label: 'Broker Listing — Local', description: 'Displays when the user\u2019s selected/search location matches this advertisement\u2019s target radius.', recommendedType: 'SPONSORED_BANNER' },
  BROKER_PROFILE_HEADER: { label: 'Broker Profile — Header', description: 'Banner on the broker profile page.', recommendedType: 'HERO_BANNER' },
  BROKER_LISTING_SIDEBAR: { label: 'Broker Listing — Sidebar', description: 'Sidebar creative on the broker listing page.', recommendedType: 'SIDEBAR_BANNER' },
  LOAN_CALCULATOR: { label: 'Loan Calculator', description: 'Banner on the loan calculator page.', recommendedType: 'SECTION_BANNER' },
  BLOG_INLINE: { label: 'Blog — Inline', description: 'Inline banner in blog articles.', recommendedType: 'INLINE_BANNER' },
  FOOTER: { label: 'Footer', description: 'Compact banner in the site footer.', recommendedType: 'FOOTER_BANNER' },
  ANNOUNCEMENT_TOP: { label: 'Announcement — Top', description: 'Dismissible announcement bar at the top.', recommendedType: 'ANNOUNCEMENT_BAR' },
  ANNOUNCEMENT_BOTTOM: { label: 'Announcement — Bottom', description: 'Dismissible announcement bar near the footer.', recommendedType: 'ANNOUNCEMENT_BAR' },
  POPUP_OVERLAY: { label: 'Popup Overlay', description: 'Modal popup over the page.', recommendedType: 'POPUP_CAMPAIGN' },
  MOBILE_HEADER_BANNER: { label: 'Mobile — Header Banner', description: 'Short banner shown on mobile near the header.', recommendedType: 'HERO_BANNER' },
}

export type CreativeSlotRequirement = {
  key: string
  format: AdvertisementFormat
  label: string
  device: 'desktop' | 'mobile'
  width: number
  height: number
  aspectRatio: string
}

export type AdvertisementRequirements = {
  placement: string
  label: string
  description: string
  recommendedType: AdType
  allowedFormats: AdvertisementFormat[]
  creativeSlots: CreativeSlotRequirement[]
  supportsDesktop: boolean
  supportsMobile: boolean
  supportsLocation: boolean
  supportsCta: boolean
}

export function getPlacementMeta(placement: string) {
  return PLACEMENT_META[placement]
}

// Resolve exactly what the selected placement requires. Derived from the
// canonical placement/format specifications — never hardcoded in components.
export function getAdvertisementRequirements(placement: string): AdvertisementRequirements {
  const meta = PLACEMENT_META[placement] ?? {
    label: placement.replace(/_/g, ' '),
    description: 'Advertisement placement.',
    recommendedType: 'SECTION_BANNER' as AdType,
  }
  const allowedFormats = getPlacementFormats(placement)
  const hasMobileFormat = allowedFormats.includes('MOBILE')
  const desktopFormats = allowedFormats.filter((format) => format !== 'MOBILE')
  const primaryFormat: AdvertisementFormat = desktopFormats[0] ?? 'MOBILE'
  const primaryReq = getFormatRequirement(primaryFormat)

  const creativeSlots: CreativeSlotRequirement[] = [
    {
      key: 'desktop',
      format: primaryFormat,
      label: formatLabel(primaryFormat),
      device: 'desktop',
      width: primaryReq.width,
      height: primaryReq.height,
      aspectRatio: primaryReq.aspectRatio,
    },
  ]
  if (hasMobileFormat) {
    const mobileReq = getFormatRequirement('MOBILE')
    creativeSlots.push({
      key: 'mobile',
      format: 'MOBILE',
      label: 'Mobile',
      device: 'mobile',
      width: mobileReq.width,
      height: mobileReq.height,
      aspectRatio: mobileReq.aspectRatio,
    })
  }

  return {
    placement,
    label: meta.label,
    description: meta.description,
    recommendedType: meta.recommendedType,
    allowedFormats,
    creativeSlots,
    supportsDesktop: desktopFormats.length > 0,
    // "Supports mobile" means the placement RENDERS on mobile devices — never
    // whether a MOBILE creative slot exists. The broker-listing local placement
    // is rendered responsively (3 → 2 → 1 columns) from a single SQUARE/BANNER
    // creative, so it supports mobile even though it has no MOBILE format.
    supportsMobile: hasMobileFormat || placement === 'BROKER_LISTING_LOCAL',
    supportsLocation: placement === 'BROKER_LISTING_LOCAL',
    supportsCta: !['ANNOUNCEMENT_TOP', 'ANNOUNCEMENT_BOTTOM', 'POPUP_OVERLAY'].includes(placement),
  }
}

function formatLabel(format: AdvertisementFormat): string {
  const labels: Record<AdvertisementFormat, string> = {
    HORIZONTAL: 'Desktop Banner',
    RECTANGLE: 'Desktop Rectangle',
    SQUARE: 'Square',
    VERTICAL: 'Vertical',
    MOBILE: 'Mobile Banner',
    BANNER: 'Rectangle Display Banner',
    WIDE_RECTANGLE: 'Wide Rectangle',
  }
  return labels[format]
}

export const ACTION_META: Record<string, { label: string; needsButton: boolean; needsUrl: boolean; description: string }> = {
  DISPLAY_ONLY: { label: 'Display Only', needsButton: false, needsUrl: false, description: 'Shows the image without any click behavior.' },
  BANNER_CLICK: { label: 'Banner Click', needsButton: false, needsUrl: true, description: 'Clicking the banner opens the destination URL.' },
  BUTTON_ONLY: { label: 'Button Only', needsButton: true, needsUrl: true, description: 'Shows a button that opens the destination URL.' },
  BANNER_AND_BUTTON: { label: 'Banner + Button', needsButton: true, needsUrl: true, description: 'Clicking the banner or the button opens the destination URL.' },
}

export const AD_TYPE_LABELS: Record<AdType, string> = {
  HERO_BANNER: 'Hero Banner',
  SECTION_BANNER: 'Section Banner',
  INLINE_BANNER: 'Inline Banner',
  SIDEBAR_BANNER: 'Sidebar Banner',
  FOOTER_BANNER: 'Footer Banner',
  SPONSORED_BANNER: 'Sponsored Banner',
  POPUP_CAMPAIGN: 'Popup Campaign',
  ANNOUNCEMENT_BAR: 'Announcement Bar',
}

const VALID_TYPES_FOR_PLACEMENT: Record<string, AdType[]> = {
  POPUP_OVERLAY: ['POPUP_CAMPAIGN'],
  ANNOUNCEMENT_TOP: ['ANNOUNCEMENT_BAR'],
  ANNOUNCEMENT_BOTTOM: ['ANNOUNCEMENT_BAR'],
  FOOTER: ['FOOTER_BANNER'],
  BROKER_LISTING_SIDEBAR: ['SIDEBAR_BANNER', 'SECTION_BANNER'],
  BROKER_LISTING_LOCAL: ['SPONSORED_BANNER', 'SECTION_BANNER'],
  HOMEPAGE_HERO: ['HERO_BANNER', 'SECTION_BANNER'],
  BROKER_PROFILE_HEADER: ['HERO_BANNER', 'SECTION_BANNER'],
  BLOG_INLINE: ['INLINE_BANNER', 'SECTION_BANNER'],
}

// UI progressive-disclosure helper: which advertisement types make sense for a
// placement. This is a UI rule, not an engine rule — the backend still accepts
// the canonical AdType enum values.
export function getValidTypesForPlacement(placement: string): AdType[] {
  return VALID_TYPES_FOR_PLACEMENT[placement] ?? ['SECTION_BANNER', 'INLINE_BANNER', 'SPONSORED_BANNER', 'HERO_BANNER']
}

export type CreativeFormatRequirement = {
  format: AdvertisementFormat
  label: string
  width: number
  height: number
  aspectRatio: string
  mobileWidth: number
  mobileHeight: number
  mobileAspectRatio: string
}

// Resolve the exact canonical creative requirement for a placement + format.
export function getCreativeRequirementForFormat(placement: string, format: AdvertisementFormat): CreativeFormatRequirement {
  const requirement = getFormatRequirement(format)
  return {
    format,
    label: FORMAT_LABELS[format],
    width: requirement.width,
    height: requirement.height,
    aspectRatio: requirement.aspectRatio,
    mobileWidth: requirement.mobile.width,
    mobileHeight: requirement.mobile.height,
    mobileAspectRatio: requirement.mobile.aspectRatio,
  }
}

const FORMAT_LABELS: Record<AdvertisementFormat, string> = {
  HORIZONTAL: 'Horizontal Banner',
  RECTANGLE: 'Rectangle',
  SQUARE: 'Square',
  VERTICAL: 'Vertical',
  MOBILE: 'Mobile Banner',
  BANNER: 'Rectangle Display Banner',
  WIDE_RECTANGLE: 'Wide Rectangle',
}
