import type { AdvertisementFormat } from './formats'
import { getFormatRequirement } from './placementSpecs'

// Canonical display aspect ratio (desktop) for a creative format. Returns the
// canonical "W:H" string from the shared format requirements, falling back to
// a sensible default for unknown formats.
export function formatAspectRatio(format: AdvertisementFormat | null | undefined): string {
  if (!format) return '1:1'
  try {
    return getFormatRequirement(format).aspectRatio
  } catch {
    return '1:1'
  }
}

// Maps a canonical aspect ratio string ("W:H") to a Tailwind-safe aspect class.
// Only complete literals are emitted so Tailwind v4's content scanner compiles
// them. `aspect-square` is the fallback for ratios without a dedicated class.
export function aspectRatioClass(ratio: string): string {
  switch (ratio) {
    case '1:1':
      return 'aspect-square'
    case '2:1':
      return 'aspect-[2/1]'
    case '3:2':
      return 'aspect-[3/2]'
    case '16:3':
      return 'aspect-[16/3]'
    case '75:32':
      return 'aspect-[75/32]'
    default:
      return 'aspect-square'
  }
}

// Resolve the aspect-ratio class for an advertisement's resolved creative
// format. Used by the public broker-listing renderer and the admin preview so
// the displayed shape always matches the actual creative (Square 1:1, Banner
// 2:1, Rectangle 3:2), never forcing every creative into a square.
export function formatAspectClass(format: AdvertisementFormat | null | undefined): string {
  return aspectRatioClass(formatAspectRatio(format))
}
