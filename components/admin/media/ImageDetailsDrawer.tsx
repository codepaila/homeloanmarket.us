/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState } from 'react'
import { motion } from 'motion/react'
import { X, Copy, Check, Tag, FolderOpen, Ruler, Crop, HardDrive, FileType2, User, Calendar, Image as ImageIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDeleteAsset, useRestoreAsset } from '@/hooks/useAdminAds'
import type { MediaAsset } from '@/lib/advertisements/types'
import { cn, formatFileSize } from '@/lib/utils'

interface ImageDetailsDrawerProps {
  asset: MediaAsset | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated?: () => void
}

export function ImageDetailsDrawer({ asset, open, onOpenChange, onUpdated }: ImageDetailsDrawerProps) {
  const [copiedUrl, setCopiedUrl] = useState(false)
  const { deleteAsset } = useDeleteAsset()
  const { restoreAsset } = useRestoreAsset()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handleCopyUrl = async (url: string) => {
    await navigator.clipboard.writeText(url)
    setCopiedUrl(true)
    setTimeout(() => setCopiedUrl(false), 2000)
  }

  const handleDelete = async () => {
    if (!asset) return
    try {
      await deleteAsset(asset.id)
      setShowDeleteConfirm(false)
      onOpenChange(false)
      onUpdated?.()
    } catch {
      // handled
    }
  }

  const handleRestore = async () => {
    if (!asset) return
    try {
      await restoreAsset(asset.id)
      onUpdated?.()
    } catch {
      // handled
    }
  }

  if (!asset) return null

  const aspectRatio = asset.width && asset.height ? (asset.width / asset.height).toFixed(2) : '—'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Asset Details</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="details" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="usage">Usage</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4 mt-4">
            <div className="aspect-video rounded-lg overflow-hidden bg-muted">
              <img src={asset.thumbnailUrl || asset.fileUrl} alt={asset.altText || asset.fileName} className="w-full h-full object-contain" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DetailItem icon={ImageIcon} label="Filename" value={asset.fileName} mono />
              <DetailItem icon={ImageIcon} label="Original Name" value={asset.originalName} mono />
              <DetailItem icon={Ruler} label="Dimensions" value={asset.width && asset.height ? `${asset.width} × ${asset.height}` : 'Unknown'} mono />
              <DetailItem icon={Crop} label="Aspect Ratio" value={`${aspectRatio}:1`} />
              <DetailItem icon={HardDrive} label="File Size" value={formatFileSize(asset.fileSize)} />
              <DetailItem icon={FileType2} label="Format" value={asset.mimeType || asset.extension.toUpperCase()} />
              {asset.altText && <DetailItem icon={Tag} label="Alt Text" value={asset.altText} />}
              {asset.title && <DetailItem icon={Tag} label="Title" value={asset.title} />}
            </div>

            {asset.tags && asset.tags.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {asset.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">{tag}</Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium">URLs</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-muted p-2 rounded">{asset.fileUrl}</code>
                  <Button size="sm" variant="outline" onClick={() => handleCopyUrl(asset.fileUrl)}>
                    {copiedUrl ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="usage" className="space-y-4 mt-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                <div>
                  <p className="text-sm font-medium">Desktop Advertisements</p>
                  <p className="text-xs text-muted-foreground">Used as desktop media</p>
                </div>
                <Badge variant="secondary">0</Badge>
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                <div>
                  <p className="text-sm font-medium">Mobile Advertisements</p>
                  <p className="text-xs text-muted-foreground">Used as mobile media</p>
                </div>
                <Badge variant="secondary">0</Badge>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>Uploaded {new Date(asset.createdAt).toLocaleDateString()}</span>
          </div>
          <div className="flex gap-2">
            {asset.isDeleted ? (
              <Button size="sm" onClick={handleRestore}>
                Restore
              </Button>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Close</Button>
                <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)}>
                  Delete
                </Button>
              </>
            )}
          </div>
        </div>

        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Asset</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">This will soft-delete this asset. It can be restored later.</p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete}>Delete</Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  )
}

interface DetailItemProps {
  icon: React.ElementType
  label: string
  value: string
  mono?: boolean
}

function DetailItem({ icon: Icon, label, value, mono }: DetailItemProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3 w-3" />
        <span className="text-xs">{label}</span>
      </div>
      <p className={cn('text-sm font-medium break-all', mono && 'font-mono text-xs')}>{value}</p>
    </div>
  )
}
