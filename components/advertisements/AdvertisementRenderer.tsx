'use client'

import { memo } from 'react'
import { PublicAdvertisement } from './PublicAdvertisement'

interface AdvertisementRendererProps {
  placement: string
  className?: string
}

export const AdvertisementRenderer = memo(function AdvertisementRenderer({ placement, className }: AdvertisementRendererProps) {
  return <PublicAdvertisement placement={placement} className={className} />
})
