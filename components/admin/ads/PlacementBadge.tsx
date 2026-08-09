'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const placementLabels: Record<string, string> = {
  HOMEPAGE_HERO: 'Home Hero',
  HOMEPAGE_SEARCH: 'Home Search',
  HOMEPAGE_FEATURED: 'Home Featured',
  HOMEPAGE_SERVICES: 'Home Services',
  HOMEPAGE_BANKS: 'Home Banks',
  HOMEPAGE_CTA: 'Home CTA',
  BROKER_LISTING: 'Broker Listing',
  BROKER_PROFILE_HEADER: 'Broker Profile Header',
  BROKER_LISTING_SIDEBAR: 'Broker Listing Sidebar',
  LOAN_CALCULATOR: 'Loan Calculator',
  BLOG_INLINE: 'Blog Inline',
  FOOTER: 'Footer',
  ANNOUNCEMENT_TOP: 'Announcement Top',
  ANNOUNCEMENT_BOTTOM: 'Announcement Bottom',
  POPUP_OVERLAY: 'Popup Overlay',
  MOBILE_HEADER_BANNER: 'Mobile Header Banner',
}

interface PlacementBadgeProps {
  placement: string
  className?: string
}

export function PlacementBadge({ placement, className }: PlacementBadgeProps) {
  const label = placementLabels[placement] || placement

  return (
    <Badge variant="outline" className={cn('font-normal text-xs', className)}>
      {label}
    </Badge>
  )
}
