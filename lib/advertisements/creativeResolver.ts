import type { AdvertisementFormat } from './formats'
import { getFormatFallbackOrder } from './formats'

export type CreativeMedia = {
  fileUrl: string
  thumbnailUrl: string | null
  altText: string | null
  width: number | null
  height: number | null
}

export type CreativeCandidate = {
  format: AdvertisementFormat
  mediaAsset: CreativeMedia
}

export function resolveAdvertisementCreative({
  placement,
  device,
  creatives = [],
  desktopMedia,
  mobileMedia,
  bannerUrl,
  altText,
}: {
  placement: string
  device: 'desktop' | 'tablet' | 'mobile'
  creatives?: CreativeCandidate[]
  desktopMedia?: CreativeMedia | null
  mobileMedia?: CreativeMedia | null
  bannerUrl?: string | null
  altText?: string | null
}): { format: AdvertisementFormat | null; media: CreativeMedia | null } {
  const order = getFormatFallbackOrder(placement, device === 'mobile')
  for (const format of order) {
    const exact = creatives.find((creative) => creative.format === format)
    if (exact) return { format, media: exact.mediaAsset }
  }

  if (device === 'mobile' && mobileMedia) return { format: 'MOBILE', media: mobileMedia }
  if (desktopMedia) return { format: order[0] || 'HORIZONTAL', media: desktopMedia }
  if (mobileMedia) return { format: 'MOBILE', media: mobileMedia }
  if (bannerUrl) {
    return {
      format: order[0] || 'HORIZONTAL',
      media: { fileUrl: bannerUrl, thumbnailUrl: null, altText: altText || null, width: null, height: null },
    }
  }
  return { format: null, media: null }
}
