'use client'

import type { PublicAdResponse } from '@/lib/advertisements/types'
import { isValidPublicAd } from '@/lib/advertisements/public'
import { AdvertisementImage } from './AdvertisementImage'
import { AdvertisementWrapper } from './AdvertisementWrapper'

// Rectangle display banner (BANNER / WIDE_RECTANGLE format) rendered as a
// proper display unit for the broker-listing local and popup placements. It is
// a wide responsive banner with an object-cover image, a brand/headline/text
// zone and an optional CTA — never forced into the square creative layout.
// The aspect ratio is derived from the resolved creative format (BANNER = 2:1
// via padding-top:50%, WIDE_RECTANGLE = 8:5 via padding-top:62.5%).
function aspectPadding(format: string | null | undefined): number {
  if (format === 'WIDE_RECTANGLE') return 62.5 // 8:5
  return 50 // 2:1 default (BANNER)
}

export function DisplayBannerCard({ ad }: { ad: PublicAdResponse | null | undefined }) {
  if (!isValidPublicAd(ad)) return null

  const hasButton = Boolean(ad.buttonLabel && ad.buttonUrl && (ad.action === 'BUTTON_ONLY' || ad.action === 'BANNER_AND_BUTTON'))
  const hasText = Boolean(ad.title || ad.description || hasButton)
  const hasImage = Boolean(ad.creative?.fileUrl || ad.desktopMedia?.fileUrl || ad.mobileMedia?.fileUrl || ad.bannerUrl)

  if (!hasImage && !hasText) return null

  const paddingTop = aspectPadding(ad.creativeFormat)

  return (
    <AdvertisementWrapper ad={ad} className="h-full w-full">
      <div className="relative h-full w-full overflow-hidden rounded bg-card">
        {/* Responsive aspect-ratio slot enforced with the padding-top box
            technique. Independent of any Tailwind utility so the ratio is
            always present and the unit never overflows or distorts. */}
        <div className="relative w-full" style={{ paddingTop: `${paddingTop}%` }}>
          {hasImage ? (
            <div className="absolute inset-0">
              <AdvertisementImage ad={ad} className="h-full w-full" objectFit="cover" loading="lazy" />
            </div>
          ) : null}
          {hasText ? (
            <div className="absolute inset-0 flex flex-col justify-end  p-4 sm:p-6">
              {/* {ad.title ? <p className="line-clamp-2 text-lg font-bold text-white sm:text-2xl">{ad.title}</p> : null} */}
              {/* {ad.description ? <p className="mt-1 line-clamp-2 text-sm text-white/90 sm:text-base">{ad.description}</p> : null} */}
              {hasButton ? (
                <span className="mt-3 inline-flex w-fit rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white">
                  {ad.buttonLabel}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </AdvertisementWrapper>
  )
}
