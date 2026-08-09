'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import useEmblaCarousel from 'embla-carousel-react'
import type { PublicAdResponse } from '@/lib/advertisements/types'
import { filterValidPublicAds } from '@/lib/advertisements/public'
import { cn } from '@/lib/utils'
import { AdvertisementCard } from './AdvertisementCard'

export function AdvertisementCarousel({
  ads,
  contentClassName,
}: {
  ads: PublicAdResponse[]
  contentClassName: string
}) {
  const validAds = filterValidPublicAds(ads)
  const [activeIndex, setActiveIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [documentHidden, setDocumentHidden] = useState(false)
  const [viewportRef, emblaApi] = useEmblaCarousel({ loop: true, watchDrag: true })

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateMotion = () => setReducedMotion(media.matches)
    const updateVisibility = () => setDocumentHidden(document.hidden)
    updateMotion()
    updateVisibility()
    media.addEventListener('change', updateMotion)
    document.addEventListener('visibilitychange', updateVisibility)
    return () => {
      media.removeEventListener('change', updateMotion)
      document.removeEventListener('visibilitychange', updateVisibility)
    }
  }, [])

  useEffect(() => {
    if (!emblaApi) return
    const updateSelected = () => setActiveIndex(emblaApi.selectedScrollSnap())
    updateSelected()
    emblaApi.on('select', updateSelected)
    emblaApi.on('reInit', updateSelected)
    return () => {
      emblaApi.off('select', updateSelected)
      emblaApi.off('reInit', updateSelected)
    }
  }, [emblaApi])

  useEffect(() => {
    if (paused || reducedMotion || documentHidden) return
    const timer = window.setInterval(() => emblaApi?.scrollNext(), 5000)
    return () => window.clearInterval(timer)
  }, [validAds.length, documentHidden, emblaApi, paused, reducedMotion])

  const showPrevious = () => emblaApi?.scrollPrev()
  const showNext = () => emblaApi?.scrollNext()

  if (validAds.length === 0) return null

  return (
    <div
      className={cn('relative h-full w-full', !reducedMotion && 'transition-opacity duration-300')}
      role="region"
      aria-roledescription="carousel"
      aria-label="Advertisements"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false)
      }}
    >
      <div ref={viewportRef} className={cn('relative h-full w-full overflow-hidden', contentClassName)}>
        <div className="flex h-full touch-pan-y">
          {validAds.map((ad) => (
            <div key={ad.id} className="min-w-0 flex-[0_0_100%] h-full">
              <AdvertisementCard ad={ad} />
            </div>
          ))}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-2 flex items-center justify-between px-2 sm:bottom-3 sm:px-3">
        <button type="button" className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" onClick={showPrevious} aria-label="Previous advertisement">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-black/45 px-2 py-1" aria-label={`${activeIndex + 1} of ${validAds.length}`}>
          {validAds.map((ad, index) => (
            <button key={ad.id} type="button" onClick={() => emblaApi?.scrollTo(index)} aria-label={`Show advertisement ${index + 1}`} aria-current={index === activeIndex ? 'true' : undefined} className={cn('h-1.5 w-1.5 rounded-full transition', index === activeIndex ? 'bg-white' : 'bg-white/50')} />
          ))}
        </div>
        <button type="button" className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" onClick={showNext} aria-label="Next advertisement">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
