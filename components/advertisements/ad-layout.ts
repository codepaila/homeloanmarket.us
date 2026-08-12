import { getDisplayHeight, getPlacementSpec, getRequiredDimensions } from '@/lib/advertisements/placementSpecs'

export type AdvertisementLayout = {
  aspectRatio: string
  className: string
  contentClassName: string
  slotClassName: string
  popup?: boolean
}

// Canonical responsive slot heights for horizontal banner placements.
// The class names MUST be complete literals in this file so Tailwind v4's
// content scanner can compile them; classes built from template interpolation
// are never emitted, which silently removes the slot height cap.
const HORIZONTAL_SLOT_HEIGHT_CLASSES: Record<string, string> = {
  '50|60|70': 'h-[50px] sm:h-[60px] lg:h-[70px]',
  '60|70|80': 'h-[60px] sm:h-[70px] lg:h-[80px]',
  '70|80|90': 'h-[70px] sm:h-[80px] lg:h-[90px]',
  '90|120|150': 'h-[90px] sm:h-[120px] lg:h-[150px]',
  '220|240|250': 'h-[220px] sm:h-[240px] lg:h-[250px]',
  '260|290|320': 'h-[260px] sm:h-[290px] lg:h-[320px]',
}

function getSlotHeightClass(mobile: number, tablet: number, desktop: number): string {
  const slotClass = HORIZONTAL_SLOT_HEIGHT_CLASSES[`${mobile}|${tablet}|${desktop}`]
  if (!slotClass) {
    throw new Error(`Missing literal slot height class for canonical heights ${mobile}/${tablet}/${desktop} in components/advertisements/ad-layout.ts`)
  }
  return slotClass
}

function horizontalSlot(placement: string, maxWidth: string): AdvertisementLayout {
  const spec = getPlacementSpec(placement)
  const mobile = getDisplayHeight(placement, 'mobile')
  const tablet = getDisplayHeight(placement, 'tablet')
  const desktop = getDisplayHeight(placement, 'desktop')
  const primary = spec?.formats[0]
  return {
    aspectRatio: primary ? getRequiredDimensions(placement, primary, 'desktop').aspectRatio : '4:1',
    className: `mx-auto w-full ${maxWidth}`,
    contentClassName: 'h-full w-full',
    slotClassName: getSlotHeightClass(mobile, tablet, desktop),
  }
}

export const AD_PLACEMENT_CONFIG: Record<string, AdvertisementLayout> = {
  HOMEPAGE_HERO: horizontalSlot('HOMEPAGE_HERO', 'max-w-[1280px]'),
  HOMEPAGE_SEARCH: horizontalSlot('HOMEPAGE_SEARCH', 'max-w-[1280px]'),
  HOMEPAGE_FEATURED: horizontalSlot('HOMEPAGE_FEATURED', 'max-w-[1280px]'),
  HOMEPAGE_SERVICES: horizontalSlot('HOMEPAGE_SERVICES', 'max-w-[1280px]'),
  HOMEPAGE_BANKS: horizontalSlot('HOMEPAGE_BANKS', 'max-w-[1280px]'),
  HOMEPAGE_CTA: horizontalSlot('HOMEPAGE_CTA', 'max-w-[1280px]'),
  BROKER_LISTING: horizontalSlot('BROKER_LISTING', 'max-w-[1280px]'),
  BROKER_LISTING_LOCAL: horizontalSlot('BROKER_LISTING_LOCAL', 'max-w-[1280px]'),
  BROKER_PROFILE_HEADER: horizontalSlot('BROKER_PROFILE_HEADER', 'max-w-[1280px]'),
  BROKER_LISTING_SIDEBAR: horizontalSlot('BROKER_LISTING_SIDEBAR', 'max-w-[320px]'),
  LOAN_CALCULATOR: horizontalSlot('LOAN_CALCULATOR', 'max-w-[970px]'),
  BLOG_INLINE: horizontalSlot('BLOG_INLINE', 'max-w-[970px]'),
  FOOTER: horizontalSlot('FOOTER', 'max-w-[1280px]'),
  ANNOUNCEMENT_TOP: horizontalSlot('ANNOUNCEMENT_TOP', 'max-w-[1440px]'),
  ANNOUNCEMENT_BOTTOM: horizontalSlot('ANNOUNCEMENT_BOTTOM', 'max-w-[1440px]'),
  POPUP_OVERLAY: {
    aspectRatio: getRequiredDimensions('POPUP_OVERLAY', 'RECTANGLE', 'desktop').aspectRatio,
    className: 'mx-auto w-full max-w-[900px]',
    contentClassName: 'h-full w-full',
    slotClassName: 'h-[min(70vh,320px)] lg:h-[min(70vh,400px)]',
    popup: true,
  },
  MOBILE_HEADER_BANNER: horizontalSlot('MOBILE_HEADER_BANNER', 'max-w-[768px]'),
}

export const DEFAULT_AD_LAYOUT = horizontalSlot('BROKER_LISTING', 'max-w-[1280px]')

export function getAdvertisementLayout(placement: string): AdvertisementLayout {
  return AD_PLACEMENT_CONFIG[placement] || DEFAULT_AD_LAYOUT
}
