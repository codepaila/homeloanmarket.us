'use client'

import type { PublicAdResponse } from '@/lib/advertisements/types'
import { isValidPublicAd } from '@/lib/advertisements/public'
import { AdvertisementImage } from './AdvertisementImage'
import { AdvertisementWrapper } from './AdvertisementWrapper'

export function AdvertisementCard({ ad }: { ad: PublicAdResponse | null | undefined }) {
  if (!isValidPublicAd(ad)) return null

  const hasButton = Boolean(ad.buttonLabel && ad.buttonUrl && (ad.action === 'BUTTON_ONLY' || ad.action === 'BANNER_AND_BUTTON'))
  const hasText = Boolean(ad.title || ad.description || hasButton)
  const hasImage = Boolean(ad.creative?.fileUrl || ad.desktopMedia?.fileUrl || ad.mobileMedia?.fileUrl || ad.bannerUrl)

  if (!hasImage && !hasText) return null

  return (
    <AdvertisementWrapper ad={ad} className="h-full w-full">
      <div className="relative h-full w-full overflow-hidden rounded-[inherit] bg-muted">
        <AdvertisementImage ad={ad} className="h-full w-full" loading="lazy" />
        {hasText ? (
          <div className="absolute inset-x-0 bottom-0 bg-black/60 p-3 text-white sm:p-5">
            {ad.title ? <p className="line-clamp-2 text-sm font-semibold sm:text-base">{ad.title}</p> : null}
            {ad.description ? <p className="mt-1 line-clamp-2 text-xs text-white/90 sm:text-sm">{ad.description}</p> : null}
            {hasButton ? <a href={ad.buttonUrl || '#'} target={ad.openInNewTab ? '_blank' : '_self'} rel="noopener noreferrer" className="mt-2 inline-flex rounded-md bg-primary px-3 py-1.5 text-xs font-semibold sm:text-sm">{ad.buttonLabel}</a> : null}
          </div>
        ) : null}
      </div>
    </AdvertisementWrapper>
  )
}
