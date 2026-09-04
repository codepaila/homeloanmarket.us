/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { motion } from 'motion/react'
import { FileImage } from 'lucide-react'
import { cn, formatFileSize } from '@/lib/utils'

interface MediaGalleryProps {
  assets: any[]
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onSelectAsset: (asset: any) => void
}

export function MediaGallery({ assets, selectedIds, onToggleSelect, onSelectAsset }: MediaGalleryProps) {
  if (assets.length === 0) {
    return (
      <div className="text-center py-16">
        <FileImage className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No media assets found</p>
      </div>
    )
  }

  return (
    <div className="columns-2 sm:columns-3 lg:columns-4 xl:columns-5 gap-4 space-y-4">
      {assets.map((asset, index) => (
        <motion.div
          key={asset.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.03 }}
          className={cn(
            'break-inside-avoid rounded overflow-hidden border border-border bg-card cursor-pointer transition-all hover:shadow-md',
            selectedIds.has(asset.id) && 'ring-2 ring-primary'
          )}
          onDoubleClick={() => onSelectAsset(asset)}
        >
          <div className="relative">
            <img
              src={asset.thumbnailUrl || asset.fileUrl}
              alt={asset.altText || asset.fileName}
              className="w-full h-auto"
              loading="lazy"
            />
            <div className="absolute top-2 left-2">
              <button
                onClick={(e) => { e.stopPropagation(); onToggleSelect(asset.id) }}
                className={cn(
                  'h-5 w-5 rounded border-2 flex items-center justify-center transition-colors',
                  selectedIds.has(asset.id) ? 'bg-primary border-primary' : 'bg-background/80 border-border hover:border-primary'
                )}
              >
                {selectedIds.has(asset.id) && <CheckIcon className="h-3 w-3 text-white" />}
              </button>
            </div>
          </div>
          <div className="p-3">
            <p className="text-xs font-medium truncate">{asset.originalName}</p>
            <p className="text-xs text-muted-foreground">{asset.width && asset.height ? `${asset.width}×${asset.height}` : '—'} • {formatFileSize(asset.fileSize)}</p>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
