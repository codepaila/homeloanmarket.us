'use client'

import { memo } from 'react'
import { PublicAdvertisement } from './PublicAdvertisement'

interface AdvertisementRendererProps {
  placement: string
  className?: string
  location?: { latitude: number; longitude: number; token?: string }
}

export const AdvertisementRenderer = memo(function AdvertisementRenderer({ placement, className, location }: AdvertisementRendererProps) {
  return <PublicAdvertisement placement={placement} className={className} location={location} />
})
