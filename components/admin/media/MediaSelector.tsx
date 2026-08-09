'use client'

import { useEffect, useRef, useState } from 'react'
import { ImageIcon, Loader2, Replace, Trash2, Upload } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { MediaPickerDialog } from '@/components/admin/ads/MediaPickerDialog'
import { useUploadAsset } from '@/hooks/useAdminAds'
import type { MediaAsset } from '@/lib/advertisements/types'
import { cn } from '@/lib/utils'

const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_FILE_SIZE = 10 * 1024 * 1024

export function MediaSelector({
  value,
  selectedAsset,
  onChange,
  label = 'Image',
  description = 'Select existing media or upload a new image.',
  folder,
  accept = 'image/jpeg,image/png,image/webp,image/gif',
  placement,
  format,
  requiredWidth,
  requiredHeight,
}: {
  value?: string | null
  selectedAsset?: MediaAsset | null
  onChange: (asset: MediaAsset | null) => void
  label?: string
  description?: string
  folder?: string
  accept?: string
  placement?: string
  format?: string
  requiredWidth?: number
  requiredHeight?: number
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [localAsset, setLocalAsset] = useState<MediaAsset | null>(null)
  const [blobPreviewUrl, setBlobPreviewUrl] = useState<string | null>(null)
  const { uploadAsset, isPending } = useUploadAsset()
  const displayAsset = localAsset && localAsset.id === value ? localAsset : selectedAsset || null
  const hasSelection = Boolean(blobPreviewUrl || value || displayAsset?.fileUrl)
  const previewUrl = blobPreviewUrl || displayAsset?.thumbnailUrl || displayAsset?.fileUrl || (value?.startsWith('/') || value?.startsWith('http') ? value : undefined)

  useEffect(() => {
    return () => {
      if (blobPreviewUrl) URL.revokeObjectURL(blobPreviewUrl)
    }
  }, [blobPreviewUrl])

  // Mirrors the canonical server rule (validateCreativeDimensions ±25%).
  // ok = well within tolerance, warn = within tolerance but off-target,
  // fail = outside tolerance (the server rejects the assignment).
  const compatibility = (() => {
    if (!displayAsset?.width || !displayAsset?.height || !placement || !format || !requiredWidth || !requiredHeight) return null
    const actualRatio = displayAsset.width / displayAsset.height
    const requiredRatio = requiredWidth / requiredHeight
    const diff = Math.abs(actualRatio - requiredRatio) / requiredRatio
    if (diff <= 0.1) return 'ok'
    if (diff <= 0.25) return 'warn'
    return 'fail'
  })() as 'ok' | 'warn' | 'fail' | null

  const handleUpload = async (file: File) => {
    setUploadError(null)
    if (!ACCEPTED_TYPES.has(file.type)) {
      setUploadError('Choose a JPEG, PNG, WebP, or GIF image.')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setUploadError('Image is too large. Maximum allowed size is 10 MB.')
      return
    }

    const objectUrl = URL.createObjectURL(file)
    setBlobPreviewUrl(objectUrl)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('altText', file.name)
      if (folder) formData.append('tags', JSON.stringify([folder]))
      const asset = await uploadAsset(formData)
      setBlobPreviewUrl(null)
      URL.revokeObjectURL(objectUrl)
      setLocalAsset(asset as MediaAsset)
      onChange(asset as MediaAsset)
      toast.success('Image uploaded and selected')
    } catch (error) {
      setBlobPreviewUrl(null)
      URL.revokeObjectURL(objectUrl)
      const message = error instanceof Error ? error.message : 'Upload failed'
      setUploadError(message)
      toast.error(message)
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      <div className={cn('overflow-hidden rounded-lg border bg-muted/30', hasSelection ? 'p-3' : 'p-6')}>
        {hasSelection && previewUrl ? (
          <div className="flex items-center gap-3">
            <div className="h-20 w-28 shrink-0 overflow-hidden rounded-md border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt={displayAsset?.altText || displayAsset?.originalName || label} className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{displayAsset?.originalName || displayAsset?.fileName || 'Selected image'}</p>
              <p className="text-xs text-muted-foreground">
                {displayAsset?.width && displayAsset?.height ? `${displayAsset.width} × ${displayAsset.height}px` : 'Image asset'}
                {displayAsset?.fileSize ? ` · ${formatFileSize(displayAsset.fileSize)}` : ''}
                {displayAsset?.extension ? ` · ${displayAsset.extension.toUpperCase()}` : ''}
              </p>
              {compatibility !== null ? (
                <p
                  className={cn(
                    'mt-0.5 flex items-center gap-1 text-xs font-medium',
                    compatibility === 'ok' ? 'text-success' : compatibility === 'warn' ? 'text-amber-600' : 'text-destructive',
                  )}
                >
                  {compatibility === 'ok' ? '✓ Compatible' : compatibility === 'warn' ? '⚠ Needs attention' : `✕ Not compatible — expected ${requiredWidth} × ${requiredHeight}px`}
                </p>
              ) : null}
              {compatibility === 'warn' && requiredWidth && requiredHeight ? (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Within tolerance, but off the recommended {requiredWidth} × {requiredHeight}px ratio.
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)} disabled={isPending}>
                <Replace className="mr-1.5 h-3.5 w-3.5" /> Replace
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => { setLocalAsset(null); onChange(null) }} disabled={isPending}>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 text-center">
            <ImageIcon className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Choose an image source</p>
            <p className="text-xs text-muted-foreground">Images are stored in the reusable Media Library.</p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" variant="outline" className="flex-1" onClick={() => setPickerOpen(true)} disabled={isPending}>
          <ImageIcon className="mr-2 h-4 w-4" /> Select from Media Library
        </Button>
        <Button type="button" variant="outline" className="flex-1" onClick={() => inputRef.current?.click()} disabled={isPending}>
          {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          {isPending ? 'Uploading...' : 'Upload from Device'}
        </Button>
        <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleUpload(file) }} />
      </div>

      {uploadError ? <p role="alert" className="text-sm text-destructive">{uploadError}</p> : null}

      <MediaPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(asset) => {
          setLocalAsset(asset)
          onChange(asset)
          setPickerOpen(false)
        }}
        selectedAssetId={value || null}
        title={`Select ${label}`}
        requiredWidth={requiredWidth}
        requiredHeight={requiredHeight}
      />
    </div>
  )
}

function formatFileSize(bytes: number): string {
  const sizeKB = bytes / 1024
  if (sizeKB >= 1024) return `${(sizeKB / 1024).toFixed(2)} MB`
  return `${sizeKB.toFixed(1)} KB`
}
