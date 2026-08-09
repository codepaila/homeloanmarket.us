'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Advertisement } from '@/lib/advertisements/types'

interface AdvertisementStatusBadgeProps {
  status: 'published' | 'draft' | 'archived' | 'scheduled' | 'expired'
  className?: string
}

export function AdvertisementStatusBadge({ status, className }: AdvertisementStatusBadgeProps) {
  const variants: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    published: { label: 'Published', variant: 'default' },
    draft: { label: 'Draft', variant: 'secondary' },
    archived: { label: 'Archived', variant: 'destructive' },
    scheduled: { label: 'Scheduled', variant: 'outline' },
    expired: { label: 'Expired', variant: 'outline' },
  }

  const config = variants[status] || variants.draft

  return (
    <Badge variant={config.variant} className={cn('font-medium', className)}>
      {config.label}
    </Badge>
  )
}

export function getAdStatus(ad: Advertisement): 'published' | 'draft' | 'archived' | 'scheduled' | 'expired' {
  if (ad.isArchived) return 'archived'
  if (ad.isEnabled) {
    if (ad.endDate && new Date(ad.endDate) < new Date()) return 'expired'
    return 'published'
  }
  if (ad.startDate && new Date(ad.startDate) > new Date()) return 'scheduled'
  return 'draft'
}
