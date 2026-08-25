'use client'

import { memo } from 'react'
import { cn } from '@/lib/utils'
import { useClickTracker, useImpressionTracker } from '@/lib/advertisements/tracker'

interface AdvertisementWrapperProps {
  ad: {
    id: string
    title: string | null
    action: string
    buttonUrl?: string | null
    bannerUrl?: string | null
    openInNewTab?: boolean
  } | null | undefined
  children: React.ReactNode
  className?: string
}

export const AdvertisementWrapper = memo(function AdvertisementWrapper({ ad, children, className }: AdvertisementWrapperProps) {
  const isValid = Boolean(ad && typeof ad.id === 'string' && ad.id.length > 0)
  const adId = ad && typeof ad.id === 'string' ? ad.id : ''
  const action = ad?.action || 'DISPLAY_ONLY'
  const buttonUrl = ad?.buttonUrl || null
  const bannerUrl = ad?.bannerUrl || null
  const openInNewTab = ad?.openInNewTab ?? true

  // DISPLAY_ONLY is not clickable. Every other action navigates natively to the
  // configured destination: BUTTON_ONLY / BANNER_AND_BUTTON prefer the button
  // URL (falling back to the banner URL), BANNER_CLICK uses the banner URL.
  const isClickable = action !== 'DISPLAY_ONLY'
  const href = isClickable
    ? (action === 'BANNER_CLICK' ? bannerUrl : buttonUrl || bannerUrl)
    : null

  // Hooks are always called (React Rules of Hooks) and no-op safely when the
  // ad is missing; the render below still returns null for invalid ads.
  useImpressionTracker(adId, isValid)
  const { trackClick } = useClickTracker(adId)

  if (!isValid || !ad) return null

  if (isClickable && href) {
    return (
      <a
        data-ad-id={ad.id}
        href={href}
        target={openInNewTab ? '_blank' : undefined}
        rel={openInNewTab ? 'noopener noreferrer' : undefined}
        aria-label={ad.title || 'Advertisement'}
        onClick={() => { void trackClick() }}
        className={cn('block', className)}
      >
        {children}
      </a>
    )
  }

  return (
    <div
      data-ad-id={ad.id}
      className={className}
      role="region"
      aria-label={ad.title || 'Advertisement'}
    >
      {children}
    </div>
  )
})