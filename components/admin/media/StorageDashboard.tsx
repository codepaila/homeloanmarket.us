/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { Image as ImageIcon, HardDrive, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useMediaAssets } from '@/hooks/useAdminAds'
import { cn, formatFileSize } from '@/lib/utils'

interface StorageDashboardProps {
  className?: string
}

export function StorageDashboard({ className }: StorageDashboardProps) {
  const { assets, total } = useMediaAssets({ limit: 100 })

  const totalStorage = assets.reduce((sum: number, a: any) => sum + (a.fileSize || 0), 0)
  const unusedAssets = assets.filter((a: any) => !a.desktopAdvertisements?.length && !a.mobileAdvertisements?.length).length
  const deletedAssets = assets.filter((a: any) => a.isDeleted).length

  const stats = [
    { label: 'Total Images', value: total.toString(), icon: ImageIcon, color: 'text-primary' },
    { label: 'Total Storage', value: formatFileSize(totalStorage), icon: HardDrive, color: 'text-success' },
    { label: 'Unused Images', value: unusedAssets.toString(), icon: Trash2, color: 'text-amber-600' },
    { label: 'Deleted Images', value: deletedAssets.toString(), icon: Trash2, color: 'text-destructive' },
  ]

  return (
    <div className={cn('grid grid-cols-2 lg:grid-cols-4 gap-4', className)}>
      {stats.map((stat, index) => (
        <Card key={index}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={cn('p-2 rounded bg-muted', stat.color)}>
              <stat.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="text-lg font-semibold">{stat.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
