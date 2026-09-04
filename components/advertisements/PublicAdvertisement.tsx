'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { PublicAdResponse } from '@/lib/advertisements/types'
import { filterValidPublicAds } from '@/lib/advertisements/public'
import { cn } from '@/lib/utils'
import { usePublicAd } from '@/hooks/useAdvertisements'
import { usePopupSession } from '@/lib/advertisements/tracker'
import { Button } from '@/components/ui/button'
import { AdvertisementCarousel } from './AdvertisementCarousel'
import { AdvertisementCard } from './AdvertisementCard'
import { DisplayBannerCard } from './DisplayBannerCard'
import { getAdvertisementLayout } from './ad-layout'
import { formatAspectClass } from '@/lib/advertisements/formatAspect'

function AdvertisementPopup({ ads, layout }: { ads: PublicAdResponse[]; layout: ReturnType<typeof getAdvertisementLayout> }) {
  const { shouldShow, markShown } = usePopupSession()
  const [visible, setVisible] = useState(false)
  const validAds = filterValidPublicAds(ads)

  useEffect(() => {
    if (!shouldShow() || validAds.length === 0) return
    const timer = window.setTimeout(() => {
      setVisible(true)
      markShown()
    }, 3000)
    return () => window.clearTimeout(timer)
  }, [markShown, shouldShow, validAds.length])

  if (!visible || validAds.length === 0) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Advertisement">
      <div className={cn('relative max-h-[90vh] w-full max-w-[900px] overflow-hidden rounded bg-background p-2 shadow-xl sm:p-4', layout.slotClassName)}>
        <Button type="button" variant="ghost" size="icon" className="absolute right-3 top-3 z-10 bg-background/80" onClick={() => setVisible(false)} aria-label="Close advertisement">
          <X className="h-4 w-4" />
        </Button>
        {validAds.length > 1 ? <AdvertisementCarousel ads={validAds} contentClassName="h-full w-full" /> : <AdvertisementCard ad={validAds[0]} />}
      </div>
    </div>
  )
}

export function PublicAdvertisement({ placement, className, location }: { placement: string; className?: string; location?: { latitude: number; longitude: number; token?: string } }) {
  const { ads, isLoading, error } = usePublicAd(placement, 10, location)
  const layout = getAdvertisementLayout(placement)
  const validAds = filterValidPublicAds(ads)

  if (error) return null
  if (validAds.length === 0) {
    if (layout.popup) return null
    if (placement === 'BROKER_LISTING_LOCAL') return null
    if (isLoading && ads.length === 0) {
      return <div className={cn('w-full overflow-hidden py-2', className)}><div className={cn('mx-auto w-full max-w-[1280px] animate-pulse rounded bg-muted', layout.slotClassName)} role="status" aria-label="Loading advertisement" /></div>
    }
    return null
  }
  if (layout.popup) return <AdvertisementPopup ads={validAds} layout={layout} />

  if (placement === 'BROKER_LISTING_LOCAL') {
    // The broker-listing local placement renders EVERY matching advertisement
    // as a compact responsive card grid: 3 columns desktop, 2 tablet, 1 mobile.
    // Each card's aspect ratio is derived from its resolved creative format —
    // SQUARE creatives render 1:1, BANNER creatives render 2:1. Creatives are
    // never forced into a square slot nor expanded into a full-width "giant"
    // banner.
    return (
      <section className={cn('w-full py-2 sm:py-3', className)} aria-label="related local resources">
        <div className="grid grid-cols-2 gap-2 md:gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {validAds.map((ad) => {
            const isDisplayBanner = ad.creativeFormat === 'BANNER' || ad.creativeFormat === 'WIDE_RECTANGLE'
            return isDisplayBanner ? (
              <div key={ad.id} className="min-w-0 overflow-hidden rounded bg-card">
                <DisplayBannerCard ad={ad} />
              </div>
            ) : (
              <div key={ad.id} className={cn('min-w-0 overflow-hidden rounded bg-card', formatAspectClass(ad.creativeFormat))}>
                <AdvertisementCard ad={ad} objectFit="cover" />
              </div>
            )
          })}
        </div>
      </section>
    )
  }

  return (
    <section className={cn('w-full overflow-hidden py-2 sm:py-3', className)} aria-label={`${placement.replaceAll('_', ' ').toLowerCase()} advertisement`}>
      <div className={cn('overflow-hidden rounded', layout.className, layout.slotClassName)}>
        {validAds.length > 1 ? <AdvertisementCarousel ads={validAds} contentClassName={layout.contentClassName} /> : <div className={cn('h-full w-full', layout.contentClassName)}><AdvertisementCard ad={validAds[0]} /></div>}
      </div>
    </section>
  )
}
