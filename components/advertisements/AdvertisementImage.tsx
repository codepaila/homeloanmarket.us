'use client'

import type { PublicAdResponse } from '@/lib/advertisements/types'
import { isValidPublicAd } from '@/lib/advertisements/public'
import { useState } from 'react'

export function AdvertisementImage({
  ad,
  className,
  loading = 'lazy',
  fetchPriority,
}: {
  ad: PublicAdResponse | null | undefined
  className?: string
  loading?: 'lazy' | 'eager'
  fetchPriority?: 'high' | 'low' | 'auto'
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null)
  if (!isValidPublicAd(ad)) return null

  const fallback = ad.creative || ad.desktopMedia || ad.mobileMedia
  const sourceUrl = fallback?.fileUrl || ad.bannerUrl || null
  if (!sourceUrl || failedSource === sourceUrl) return null

  return (
    <picture className="block h-full w-full max-w-full">
      {ad.creative?.fileUrl && (
        <source media="(max-width: 767px)" srcSet={ad.creative.fileUrl} />
      )}
      <img
        src={sourceUrl}
        alt={fallback?.altText || ad.altText || ad.title || 'Advertisement'}
        className={`block max-w-full object-contain ${className || ''}`}
        loading={loading}
        fetchPriority={fetchPriority}
        onError={() => setFailedSource(sourceUrl)}
      />
    </picture>
  )
}
