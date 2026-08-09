'use client'

import { useState, useMemo, useCallback } from 'react'
import { Search, FolderOpen, Grid3X3, List, ImageIcon, Check } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useMediaAssets, useMediaFolders } from '@/hooks/useAdminAds'
import type { MediaAsset } from '@/lib/advertisements/types'
import { motion, AnimatePresence } from 'motion/react'
import { cn } from '@/lib/utils'

interface MediaPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (asset: MediaAsset) => void
  selectedAssetId?: string | null
  title?: string
  description?: string
  requiredWidth?: number
  requiredHeight?: number
}

type ViewMode = 'grid' | 'list'
type SortOption = 'newest' | 'oldest' | 'name'

const FILE_SIZE_LABELS: Record<string, string> = {
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
  'image/webp': 'WebP',
  'image/svg+xml': 'SVG',
  'image/gif': 'GIF',
}

export function MediaPickerDialog({
  open,
  onOpenChange,
  onSelect,
  selectedAssetId,
  title = 'Select Media',
  description = 'Choose an image from your media library',
  requiredWidth,
  requiredHeight,
}: MediaPickerDialogProps) {
  const [search, setSearch] = useState('')
  const [folderId, setFolderId] = useState<string | undefined>(undefined)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [sort, setSort] = useState<SortOption>('newest')
  const [selectedId, setSelectedId] = useState<string | null>(selectedAssetId || null)

  const { assets, total, isLoading, error, mutate } = useMediaAssets({
    page: 1,
    limit: 50,
    search: search || undefined,
    folderId,
  })

  const { folders } = useMediaFolders()

  const isAssetCompatible = useCallback((asset: MediaAsset) => {
    if (!requiredWidth || !requiredHeight || !asset.width || !asset.height) return null
    const actualRatio = asset.width / asset.height
    const requiredRatio = requiredWidth / requiredHeight
    return Math.abs(actualRatio - requiredRatio) / requiredRatio <= 0.25
  }, [requiredWidth, requiredHeight])

  const sortedAssets = useMemo(() => {
    const sorted = [...assets]
    switch (sort) {
      case 'oldest':
        sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        break
      case 'name':
        sorted.sort((a, b) => a.originalName.localeCompare(b.originalName))
        break
      case 'newest':
      default:
        sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        break
    }
    if (requiredWidth && requiredHeight) {
      sorted.sort((a, b) => Number(isAssetCompatible(b)) - Number(isAssetCompatible(a)))
    }
    return sorted
  }, [assets, sort, requiredWidth, requiredHeight, isAssetCompatible])

  const handleSelect = useCallback(
    (asset: MediaAsset) => {
      setSelectedId(asset.id)
      onSelect(asset)
      onOpenChange(false)
    },
    [onSelect, onOpenChange]
  )

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getFileTypeLabel = (mimeType: string) => {
    return FILE_SIZE_LABELS[mimeType] || mimeType.split('/')[1]?.toUpperCase() || 'FILE'
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <Input
              placeholder="Search media..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={folderId || ''}
              onChange={(e) => setFolderId(e.target.value || undefined)}
              className="h-9 rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="">All Folders</option>
               {folders.map((folder: { id: string; name: string }) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="h-9 rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="name">Name A-Z</option>
            </select>

            <div className="flex border border-border rounded-md">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setViewMode('grid')}
                className={viewMode === 'grid' ? 'bg-accent' : ''}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setViewMode('list')}
                className={viewMode === 'list' ? 'bg-accent' : ''}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto -mx-2 px-2">
          {error && (
            <div className="py-8 text-center">
              <p className="text-sm text-destructive mb-2">Failed to load media</p>
              <Button type="button" variant="outline" size="sm" onClick={() => mutate()}>
                Retry
              </Button>
            </div>
          )}

          {!error && isLoading && (
            <div className={viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4' : 'space-y-2'}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="aspect-video rounded-lg" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          )}

          {!error && !isLoading && sortedAssets.length === 0 && (
            <div className="py-12 text-center">
              <FolderOpen className="h-12 w-12 text-text-muted mx-auto mb-3" />
              <p className="text-sm font-medium text-text-main">No media found</p>
              <p className="text-xs text-text-muted mt-1">
                {search ? 'Try adjusting your search terms' : 'Upload media in the Media Library'}
              </p>
            </div>
          )}

          {!error && !isLoading && sortedAssets.length > 0 && (
            <div className={viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4' : 'space-y-2'}>
              <AnimatePresence>
                {sortedAssets.map((asset: MediaAsset) => {
                  const isSelected = selectedId === asset.id
                  const previewUrl = asset.thumbnailUrl || asset.fileUrl

                  if (viewMode === 'grid') {
                    return (
                      <motion.button
                        key={asset.id}
                        type="button"
                        onClick={() => handleSelect(asset)}
                        className={cn(
                          'group relative aspect-video rounded-lg border-2 overflow-hidden bg-muted transition-all',
                          isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/50'
                        )}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {previewUrl ? (
                          <img
                            src={previewUrl}
                            alt={asset.altText || asset.originalName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="h-8 w-8 text-text-muted" />
                          </div>
                        )}

                        {/* Overlay */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          {isSelected ? (
                            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                              <Check className="h-4 w-4 text-white" />
                            </div>
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                              <Check className="h-4 w-4 text-white" />
                            </div>
                          )}
                        </div>

                        {/* Badge */}
                        <div className="absolute top-2 left-2">
                          <Badge variant="secondary" className="text-xs">
                            {getFileTypeLabel(asset.mimeType)}
                          </Badge>
                        </div>

                        {/* Compatibility badge */}
                        {requiredWidth && requiredHeight && isAssetCompatible(asset) === false && (
                          <div className="absolute top-2 right-2">
                            <Badge variant="destructive" className="text-[10px]">Not compatible</Badge>
                          </div>
                        )}

                        {/* Info */}
                        <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/60">
                          <p className="text-xs text-white truncate">{asset.originalName}</p>
                          <p className="text-xs text-white/70">
                            {formatFileSize(asset.fileSize)}
                            {asset.width && asset.height && ` • ${asset.width}×${asset.height}`}
                          </p>
                        </div>
                      </motion.button>
                    )
                  }

                  return (
                    <motion.button
                      key={asset.id}
                      type="button"
                      onClick={() => handleSelect(asset)}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left',
                        isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                      )}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center overflow-hidden shrink-0">
                        {previewUrl ? (
                          <img src={previewUrl} alt={asset.altText || asset.originalName} className="h-full w-full object-cover" />
                        ) : (
                          <ImageIcon className="h-5 w-5 text-text-muted" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{asset.originalName}</p>
                        <p className="text-xs text-text-muted">
                          {getFileTypeLabel(asset.mimeType)} • {formatFileSize(asset.fileSize)}
                          {asset.width && asset.height && ` • ${asset.width}×${asset.height}`}
                        </p>
                      </div>

                      {isSelected && (
                        <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center shrink-0">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </motion.button>
                  )
                })}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-xs text-text-muted">
            {total} asset{total !== 1 ? 's' : ''} total
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!selectedId}
              onClick={() => {
                const asset = sortedAssets.find((a) => a.id === selectedId)
                if (asset) {
                  handleSelect(asset)
                }
              }}
            >
              Select Media
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
