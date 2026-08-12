export const ADVERTISEMENT_FORMATS = ['HORIZONTAL', 'VERTICAL', 'SQUARE', 'RECTANGLE', 'MOBILE'] as const

export type AdvertisementFormat = typeof ADVERTISEMENT_FORMATS[number]

export const ADVERTISEMENT_FORMAT_INFO: Record<AdvertisementFormat, {
  label: string
  description: string
  aspectRatio: string
  recommendedSize: string
}> = {
  HORIZONTAL: { label: 'Horizontal', description: 'Wide banner creative for hero, header, inline, and footer placements.', aspectRatio: '2:1 to 4:1', recommendedSize: '1200 × 400' },
  VERTICAL: { label: 'Vertical', description: 'Portrait creative for sidebars and rail placements.', aspectRatio: '2:3 to 1:2', recommendedSize: '600 × 900' },
  SQUARE: { label: 'Square', description: 'Balanced creative for cards, grids, and compact placements.', aspectRatio: '1:1', recommendedSize: '800 × 800' },
  RECTANGLE: { label: 'Rectangle', description: 'Standard promotional creative for content and sidebar placements.', aspectRatio: '4:3 to 3:2', recommendedSize: '1200 × 800' },
  MOBILE: { label: 'Mobile', description: 'Mobile-specific banner or portrait creative.', aspectRatio: '4:3 to 2:1', recommendedSize: '750 × 900' },
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

export function isAssetCompatibleWithFormat(format: AdvertisementFormat, width: number | null | undefined, height: number | null | undefined): boolean {
  if (!width || !height) return true
  const ratio = width / height
  const ranges: Record<AdvertisementFormat, [number, number]> = {
    HORIZONTAL: [1.5, 5],
    VERTICAL: [0.3, 0.75],
    SQUARE: [0.8, 1.25],
    RECTANGLE: [1.15, 2],
    MOBILE: [0.5, 3],
  }
  const [minimum, maximum] = ranges[format]
  return ratio >= minimum && ratio <= maximum
}
