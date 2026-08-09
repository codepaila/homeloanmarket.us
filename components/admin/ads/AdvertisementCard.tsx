'use client'

import { motion } from 'motion/react'
import { Eye } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AdvertisementStatusBadge, getAdStatus } from './AdvertisementStatusBadge'
import { PlacementBadge } from './PlacementBadge'
import { formatAdminDate } from '@/lib/admin/advertisement-dto'
import type { Advertisement } from '@/lib/advertisements/types'

interface AdvertisementCardProps {
  ad: Advertisement
  className?: string
}

export function AdvertisementCard({ ad, className }: AdvertisementCardProps) {
  const status = getAdStatus(ad)
  const previewUrl = ad.desktopMedia?.thumbnailUrl || ad.desktopMedia?.fileUrl || ad.bannerUrl || '/placeholder.png'

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className={className}
    >
      <Card className="h-full hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base font-semibold truncate">
                {ad.title}
              </CardTitle>
              <div className="flex items-center gap-2 mt-2">
                <AdvertisementStatusBadge status={status} />
                <PlacementBadge placement={ad.placement} />
              </div>
            </div>
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
              {previewUrl && previewUrl !== '/placeholder.png' ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt={ad.altText || ad.title}
                    className="h-full w-full object-cover"
                  />
                </>
              ) : (
                <Eye className="h-4 w-4 text-text-muted" />
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-text-muted line-clamp-2 mb-3">
            {ad.description || 'No description'}
          </p>
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>Priority: {ad.priority}</span>
            <span>{formatAdminDate(ad.updatedAt, false)}</span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
