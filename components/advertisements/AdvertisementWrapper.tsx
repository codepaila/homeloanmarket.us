'use client'

import { memo } from 'react'
import { useClickTracker, useImpressionTracker } from '@/lib/advertisements/tracker'

interface AdvertisementWrapperProps {
  ad: {
    id: string
    title: string | null
    action: string
    buttonLabel?: string | null
    buttonUrl?: string | null
    bannerUrl?: string | null
    openInNewTab?: boolean
  } | null | undefined
  children: React.ReactNode
  className?: string
}

export const AdvertisementWrapper = memo(function AdvertisementWrapper({ ad, children, className }: AdvertisementWrapperProps) {
  const isValid = Boolean(ad && typeof ad.id === 'string' && ad.id.length > 0)
  const adId = ad?.id && typeof ad.id === 'string' ? ad.id : ''

  // Hooks are always called (React Rules of Hooks) and no-op safely when the
  // ad is missing; the render below still returns null for invalid ads.
  useImpressionTracker(adId, isValid)
  const { trackClick: trackButtonClick } = useClickTracker(adId, ad?.buttonUrl, ad?.openInNewTab)
  const { trackClick: trackBannerClick } = useClickTracker(adId, ad?.bannerUrl, ad?.openInNewTab)

  if (!isValid || !ad) return null

  const handleClick = (event: { preventDefault(): void; stopPropagation(): void; target: EventTarget | null }) => {
    const clickedLink = event.target instanceof HTMLAnchorElement
    if (ad.action === 'BUTTON_ONLY' && !clickedLink) return
    if (ad.action === 'DISPLAY_ONLY') return

    const track = clickedLink || ad.action === 'BUTTON_ONLY' ? trackButtonClick : trackBannerClick
    if ((clickedLink || ad.action === 'BUTTON_ONLY') && !ad.buttonUrl) return
    if (!clickedLink && ad.action !== 'BUTTON_ONLY' && !ad.bannerUrl) return

    event.preventDefault()
    event.stopPropagation()
    void track()
  }

  return (
    <div
      data-ad-id={ad.id}
      className={className}
      onClick={ad.action !== 'DISPLAY_ONLY' ? handleClick : undefined}
      role={ad.action !== 'DISPLAY_ONLY' ? 'button' : 'region'}
      aria-label={ad.title || 'Advertisement'}
      tabIndex={ad.action !== 'DISPLAY_ONLY' ? 0 : undefined}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleClick(e)
        }
      }}
    >
      {children}
    </div>
  )
})
