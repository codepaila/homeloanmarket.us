'use client'

import useSWR from 'swr'
import { baseUrl } from '@/utils/baseUrl'
import type { PublicAdsResponse } from '@/lib/advertisements/types'
import { filterValidPublicAds } from '@/lib/advertisements/public'

const fetcher = async (url: string) => {
  const res = await fetch(url)
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.message || data.error || 'Failed to fetch advertisement')
  }
  return {
    success: true,
    ads: filterValidPublicAds(data?.ads),
  } satisfies PublicAdsResponse
}

export function usePublicAd(placement: string, limit: number = 1, location?: { latitude: number; longitude: number; token?: string }) {
  const placementKey = placement.toLowerCase().replace(/_/g, '-')
  const locationQuery = location ? `&latitude=${encodeURIComponent(location.latitude)}&longitude=${encodeURIComponent(location.longitude)}${location.token ? `&locationToken=${encodeURIComponent(location.token)}` : ''}` : ''

  const { data, error, isLoading, mutate } = useSWR(
    placement === 'BROKER_LISTING_LOCAL' && !location
      ? null
      : `${baseUrl}/api/ads/public?placement=${encodeURIComponent(placementKey)}&limit=${limit}${locationQuery}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
      shouldRetryOnError: false,
    }
  )

  return {
    ads: data?.ads || [],
    isLoading,
    error,
    mutate,
  }
}

export function useDeviceType() {
  if (typeof window === 'undefined') return 'desktop'

  const width = window.innerWidth
  if (width < 768) return 'mobile'
  if (width < 1024) return 'tablet'
  return 'desktop'
}
