export const ADVERTISEMENT_FORMATS = ['HORIZONTAL', 'VERTICAL', 'SQUARE', 'RECTANGLE', 'MOBILE'] as const

export type AdvertisementFormat = typeof ADVERTISEMENT_FORMATS[number]

export const ADVERTISEMENT_FORMAT_INFO: Record<AdvertisementFormat, {
  label: string
  description: string
}> = {
  HORIZONTAL: { label: 'Horizontal', description: 'Wide banner creative for hero, header, inline, and footer placements.' },
  VERTICAL: { label: 'Vertical', description: 'Portrait creative for sidebars and rail placements.' },
  SQUARE: { label: 'Square', description: 'Balanced creative for cards, grids, and compact placements.' },
  RECTANGLE: { label: 'Rectangle', description: 'Standard promotional creative for content and sidebar placements.' },
  MOBILE: { label: 'Mobile', description: 'Mobile-specific banner or portrait creative.' },
}

export const PLACEMENT_FORMATS: Record<string, AdvertisementFormat[]> = {
  HOMEPAGE_HERO: ['HORIZONTAL', 'RECTANGLE', 'MOBILE'],
  HOMEPAGE_SEARCH: ['HORIZONTAL', 'RECTANGLE', 'MOBILE'],
  HOMEPAGE_FEATURED: ['HORIZONTAL', 'SQUARE', 'RECTANGLE', 'MOBILE'],
  HOMEPAGE_SERVICES: ['HORIZONTAL', 'RECTANGLE', 'SQUARE', 'MOBILE'],
  HOMEPAGE_BANKS: ['SQUARE', 'HORIZONTAL', 'RECTANGLE'],
  HOMEPAGE_CTA: ['HORIZONTAL', 'RECTANGLE', 'MOBILE'],
  BROKER_LISTING: ['HORIZONTAL', 'RECTANGLE', 'MOBILE'],
  BROKER_LISTING_LOCAL: ['SQUARE'],
  BROKER_PROFILE_HEADER: ['HORIZONTAL', 'RECTANGLE', 'MOBILE'],
  BROKER_LISTING_SIDEBAR: ['VERTICAL', 'RECTANGLE', 'SQUARE', 'MOBILE'],
  LOAN_CALCULATOR: ['RECTANGLE', 'HORIZONTAL', 'SQUARE', 'MOBILE'],
  BLOG_INLINE: ['RECTANGLE', 'HORIZONTAL', 'SQUARE', 'MOBILE'],
  FOOTER: ['HORIZONTAL', 'RECTANGLE', 'MOBILE'],
  ANNOUNCEMENT_TOP: ['HORIZONTAL', 'MOBILE'],
  ANNOUNCEMENT_BOTTOM: ['HORIZONTAL', 'MOBILE'],
  POPUP_OVERLAY: ['RECTANGLE', 'SQUARE', 'HORIZONTAL', 'VERTICAL', 'MOBILE'],
  MOBILE_HEADER_BANNER: ['MOBILE', 'HORIZONTAL', 'RECTANGLE'],
}

export function getPlacementFormats(placement: string): AdvertisementFormat[] {
  return PLACEMENT_FORMATS[placement] || ['HORIZONTAL', 'RECTANGLE', 'MOBILE']
}

export function getFormatFallbackOrder(placement: string, isMobile: boolean): AdvertisementFormat[] {
  const compatible = getPlacementFormats(placement)
  const preferred = isMobile
    ? ['MOBILE', 'HORIZONTAL', 'RECTANGLE', 'SQUARE', 'VERTICAL']
    : compatible
  return [...preferred.filter((format) => compatible.includes(format as AdvertisementFormat)), ...compatible.filter((format) => !preferred.includes(format))] as AdvertisementFormat[]
}

export function isFormatCompatible(placement: string, format: AdvertisementFormat): boolean {
  return getPlacementFormats(placement).includes(format)
}
