/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useMemo } from 'react'
import { motion } from 'motion/react'
import { Image as ImageIcon, FileImage, FolderOpen, MoreVertical, Edit, Trash2, Copy, ExternalLink, Replace, Eye } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useMediaAssets, useMediaFolders, useDeleteAsset, useRestoreAsset } from '@/hooks/useAdminAds'
import type { MediaAsset } from '@/lib/advertisements/types'
import { cn, formatFileSize } from '@/lib/utils'

interface MediaGridProps {
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onSelectAsset: (asset: MediaAsset) => void
  showDeleted?: boolean
}

export function MediaGrid({ selectedIds, onToggleSelect, onSelectAsset, showDeleted }: MediaGridProps) {
  const { assets, isLoading } = useMediaAssets({ limit: 50 })
  const { folders } = useMediaFolders()
  const { deleteAsset } = useDeleteAsset()
  const { restoreAsset } = useRestoreAsset()
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const folderMap = useMemo(() => {
    const map = new Map<string, string>()
    folders.forEach((f: any) => map.set(f.id, f.name))
    return map
  }, [folders])

  const handleDelete = async (id: string) => {
    try {
      await deleteAsset(id)
      setDeleteConfirm(null)
    } catch {
      // error handled by hook
    }
  }

  const handleRestore = async (id: string) => {
    try {
      await restoreAsset(id)
    } catch {
      // error handled by hook
    }
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {Array.from({ length: 10 }).map((_, i: number) => (
          <div key={i} className="aspect-square rounded-lg border border-border bg-card animate-pulse" />
        ))}
      </div>
    )
  }

  if (assets.length === 0) {
    return (
      <div className="text-center py-16">
        <FileImage className="h-12 w-12 text-text-muted mx-auto mb-3" />
        <p className="text-sm text-text-muted">No media assets found</p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {assets.map((asset: any, index: number) => {
          const isSelected = selectedIds.has(asset.id)
          return (
            <motion.div
              key={asset.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.02 }}
              onDoubleClick={() => onSelectAsset(asset)}
            >
              <Card
                className={cn(
                  'group relative cursor-pointer transition-all hover:shadow-md',
                  isSelected && 'ring-2 ring-primary'
                )}
              >
                <CardContent className="p-0">
                  <div className="aspect-square relative overflow-hidden rounded-t-lg bg-muted">
                    <img
                      src={asset.thumbnailUrl || asset.fileUrl}
                      alt={asset.altText || asset.fileName}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                    <div className="absolute top-2 left-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 bg-background/80 hover:bg-background"
                        onClick={(e) => { e.stopPropagation(); onToggleSelect(asset.id) }}
                      >
                        <Eye className={cn('h-3 w-3', isSelected && 'text-primary')} />
                      </Button>
                    </div>
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6 bg-background/80 hover:bg-background">
                            <MoreVertical className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onSelectAsset(asset)}>
                            <Eye className="h-4 w-4 mr-2" /> View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(asset.fileUrl); }}>
                            <Copy className="h-4 w-4 mr-2" /> Copy URL
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(asset.fileUrl); }}>
                            <ExternalLink className="h-4 w-4 mr-2" /> Copy Full URL
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Replace className="h-4 w-4 mr-2" /> Replace
                          </DropdownMenuItem>
                          {showDeleted ? (
                            <DropdownMenuItem onClick={() => handleRestore(asset.id)}>
                              <Eye className="h-4 w-4 mr-2" /> Restore
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => setDeleteConfirm(asset.id)} className="text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex gap-1">
                        <Button size="sm" variant="secondary" className="text-xs h-7 flex-1" onClick={() => onSelectAsset(asset)}>
                          View
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 space-y-1">
                    <p className="text-xs font-medium truncate">{asset.originalName}</p>
                    <div className="flex items-center justify-between text-xs text-text-muted">
                      <span>{asset.width && asset.height ? `${asset.width}×${asset.height}` : '—'}</span>
                      <Badge variant="secondary" className="text-xs">{asset.extension.toUpperCase()}</Badge>
                    </div>
                    <p className="text-xs text-text-muted">{formatFileSize(asset.fileSize)}</p>
                    {asset.folderId && folderMap.get(asset.folderId) && (
                      <p className="text-xs text-text-muted truncate">{folderMap.get(asset.folderId)}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Asset</DialogTitle>
            <DialogDescription>
              This will soft-delete this asset. It will be removed from the library but can be restored later.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

