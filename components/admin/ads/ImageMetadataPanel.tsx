'use client'

import {
  Image,
  Folder,
  Ruler,
  Crop,
  HardDrive,
  FileType2,
  Type,
  Tag,
  User,
  Calendar,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { MediaAsset } from '@/lib/advertisements/types'
import { resolveAssetFormat } from '@/lib/advertisements/assetFormat'

interface ImageMetadataPanelProps {
  asset: MediaAsset | null | undefined
  className?: string
}

export function ImageMetadataPanel({ asset, className }: ImageMetadataPanelProps) {
  if (!asset) {
    return (
      <Card className={cn('border-dashed', className)}>
        <CardContent className="py-6 text-center">
          <p className="text-sm text-text-muted">Select media to view metadata</p>
        </CardContent>
      </Card>
    )
  }

  const sizeKB = asset.fileSize ? (asset.fileSize / 1024).toFixed(1) : null
  const sizeMB = sizeKB ? (parseFloat(sizeKB) / 1024).toFixed(2) : null
  const displaySize = sizeMB && parseFloat(sizeMB) >= 1 ? `${sizeMB} MB` : sizeKB ? `${sizeKB} KB` : null
  // Canonical format resolution — never crashes when fileName is missing.
  const resolvedFormat = resolveAssetFormat(asset)

  return (
    <Card className={cn('border-border bg-card', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Media Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-3">
          <MetadataItem icon={Image} label="Filename" value={asset.fileName} mono />
          <MetadataItem icon={Type} label="Alt Text" value={asset.altText || 'Not set'} mono />
          <MetadataItem icon={Ruler} label="Dimensions" value={asset.width && asset.height ? `${asset.width} × ${asset.height}` : 'Unknown'} mono />
          <MetadataItem icon={Crop} label="Aspect Ratio" value={asset.width && asset.height ? `${(asset.width / asset.height).toFixed(2)}:1` : 'Unknown'} />
          <MetadataItem icon={HardDrive} label="File Size" value={displaySize || 'Unknown'} />
          <MetadataItem icon={FileType2} label="Format" value={asset.mimeType || (resolvedFormat.format ? resolvedFormat.format.toUpperCase() : null) || 'Unknown'} />
          <MetadataItem icon={Folder} label="Folder ID" value={asset.folderId || 'Root'} mono />
          <MetadataItem icon={User} label="Uploader ID" value={asset.uploaderId} mono />
          <MetadataItem icon={Calendar} label="Upload Date" value={asset.createdAt ? formatDate(asset.createdAt) : 'Unknown'} />

          {asset.tags && asset.tags.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-text-muted">
                <Tag className="h-3 w-3" />
                <span className="text-xs">Tags</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {asset.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

interface MetadataItemProps {
  icon: React.ElementType
  label: string
  value: string
  mono?: boolean
}

function MetadataItem({ icon: Icon, label, value, mono }: MetadataItemProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-text-muted">
        <Icon className="h-3 w-3" />
        <span className="text-xs">{label}</span>
      </div>
      <p className={cn('text-sm font-medium break-all', mono && 'font-mono text-xs')}>
        {value}
      </p>
    </div>
  )
}

function formatDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(dateObj)
}
