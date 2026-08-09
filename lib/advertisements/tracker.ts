'use client'

import { useCallback, useEffect, useRef } from 'react'
import { baseUrl } from '@/utils/baseUrl'

const TRACKED_IMPRESSIONS_KEY = 'hm_tracked_impressions'
const TRACKED_CLICKS_KEY = 'hm_tracked_clicks'
const DISMISSED_ADS_KEY = 'hm_dismissed_ads'
const POPUP_SESSION_KEY = 'hm_popup_shown_session'

function getStoredIds(key: string): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const stored = localStorage.getItem(key)
    return new Set(stored ? JSON.parse(stored) : [])
  } catch {
    return new Set()
  }
}

function storeId(key: string, id: string) {
  try {
    const ids = getStoredIds(key)
    ids.add(id)
    localStorage.setItem(key, JSON.stringify([...ids]))
  } catch {
    // ignore storage errors
  }
}

export function useImpressionTracker(adId: string, enabled: boolean = true) {
  const hasTrackedRef = useRef(false)

  const trackImpression = useCallback(async () => {
    if (!enabled || hasTrackedRef.current) return
    hasTrackedRef.current = true

    const tracked = getStoredIds(TRACKED_IMPRESSIONS_KEY)
    if (tracked.has(adId)) return

    try {
      await fetch(`${baseUrl}/api/ads/impression`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ advertisementId: adId }),
        keepalive: true,
      })
      storeId(TRACKED_IMPRESSIONS_KEY, adId)
    } catch {
      // silently fail - tracking should never break the page
    }
  }, [adId, enabled])

  useEffect(() => {
    if (!enabled) return

    const element = document.querySelector(`[data-ad-id="${adId}"]`)
    if (!element) return

    let timer: number | undefined
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && timer === undefined) {
            timer = window.setTimeout(() => {
              timer = undefined
              trackImpression()
            }, 500)
          } else if (!entry.isIntersecting && timer !== undefined) {
            window.clearTimeout(timer)
            timer = undefined
          }
        })
      },
      { threshold: 0.5 }
    )

    observer.observe(element)
    return () => {
      observer.disconnect()
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [adId, enabled, trackImpression])

  return { trackImpression }
}

export function useClickTracker(adId: string, url: string | null | undefined, openInNewTab: boolean = true) {
  const trackClick = useCallback(async () => {
    if (!adId || !url) return

    const tracked = getStoredIds(TRACKED_CLICKS_KEY)
    if (tracked.has(adId)) {
      if (url) window.open(url, openInNewTab ? '_blank' : '_self', 'noopener,noreferrer')
      return
    }

    try {
      await fetch(`${baseUrl}/api/ads/click`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ advertisementId: adId }),
        keepalive: true,
      })
      storeId(TRACKED_CLICKS_KEY, adId)
    } catch {
      // silently fail
    } finally {
      if (url) window.open(url, openInNewTab ? '_blank' : '_self', 'noopener,noreferrer')
    }
  }, [adId, url, openInNewTab])

  return { trackClick }
}

export function useDismissibleAd(adId: string | null | undefined, isDismissible: boolean = false) {
  const isDismissedRef = useRef(false)

  const dismiss = useCallback(() => {
    if (!adId || !isDismissible || isDismissedRef.current) return
    isDismissedRef.current = true

    try {
      const dismissed = getStoredIds(DISMISSED_ADS_KEY)
      dismissed.add(adId)
      localStorage.setItem(DISMISSED_ADS_KEY, JSON.stringify([...dismissed]))
    } catch {
      // ignore
    }
  }, [adId, isDismissible])

  const isDismissed = useCallback(() => {
    if (!adId || !isDismissible) return false
    const dismissed = getStoredIds(DISMISSED_ADS_KEY)
    return dismissed.has(adId)
  }, [adId, isDismissible])

  return { dismiss, isDismissed }
}

export function usePopupSession() {
  const hasShownRef = useRef(false)

  const markShown = useCallback(() => {
    if (hasShownRef.current) return
    hasShownRef.current = true
    try {
      sessionStorage.setItem(POPUP_SESSION_KEY, 'true')
    } catch {
      // ignore
    }
  }, [])

  const shouldShow = useCallback(() => {
    if (hasShownRef.current) return false
    try {
      return sessionStorage.getItem(POPUP_SESSION_KEY) !== 'true'
    } catch {
      return true
    }
  }, [])

  return { markShown, shouldShow }
}
