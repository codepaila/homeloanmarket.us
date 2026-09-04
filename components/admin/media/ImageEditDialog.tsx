/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState } from 'react'
import { motion } from 'motion/react'
import { X, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'react-hot-toast'
import { useUpdateAsset } from '@/hooks/useAdminAds'
import type { MediaAsset } from '@/lib/advertisements/types'
import { formatFileSize } from '@/lib/utils'

interface ImageEditDialogProps {
  asset: MediaAsset | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated?: () => void
}

export function ImageEditDialog({ asset, open, onOpenChange, onUpdated }: ImageEditDialogProps) {
  const [title, setTitle] = useState('')
  const [altText, setAltText] = useState('')
  const { updateAsset, isPending } = useUpdateAsset()

  if (asset) {
    setTitle(asset.title || '')
    setAltText(asset.altText || '')
  }

  const handleSave = async () => {
    if (!asset) return
    try {
      await updateAsset(asset.id, {
        title: title || undefined,
        altText: altText || undefined,
      })
      toast.success('Asset updated successfully')
      onOpenChange(false)
      onUpdated?.()
    } catch {
      toast.error('Failed to update')
    }
  }

  if (!asset) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Asset</DialogTitle>
          <DialogDescription>Update metadata for this asset</DialogDescription>
        </DialogHeader>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="aspect-video rounded overflow-hidden bg-muted">
            <img src={asset.thumbnailUrl || asset.fileUrl} alt={asset.fileName} className="w-full h-full object-contain" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Asset title" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="altText">Alt Text</Label>
            <Textarea id="altText" value={altText} onChange={(e) => setAltText(e.target.value)} placeholder="Description for accessibility" rows={3} />
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Filename</p>
            <p className="text-sm font-mono">{asset.fileName}</p>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Format</p>
            <p className="text-sm">{asset.mimeType} • {formatFileSize(asset.fileSize)}</p>
          </div>
        </motion.div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Cancel</Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
