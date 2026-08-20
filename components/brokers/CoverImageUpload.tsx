'use client'

import { useRef, useState } from 'react'
import { toast } from 'react-hot-toast'
import { Loader2, ImageIcon, Upload } from 'lucide-react'
import { MediaPickerDialog } from '@/components/admin/ads/MediaPickerDialog'
import type { MediaAsset } from '@/lib/advertisements/types'

interface CoverImageUploadProps {
  value?: string | null
  uploadUrl: string
  removeUrl: string
  /** When provided, enables "Choose from Media": an admin-only endpoint that
   *  applies an existing Media Library asset as the cover (server-resolved). */
  mediaSelectUrl?: string
  onUploaded?: (url: string | null) => void
  label?: string
}

export function CoverImageUpload({
  value,
  uploadUrl,
  removeUrl,
  mediaSelectUrl,
  onUploaded,
  label = 'Cover image',
}: CoverImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(value || null)
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [applyingMedia, setApplyingMedia] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [source, setSource] = useState<'upload' | 'media' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const busy = uploading || removing || applyingMedia

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setError(null)
    setSource('upload')
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch(uploadUrl, { method: 'POST', body: formData })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to upload cover image. Please try again.')
      setPreview(data.coverImage ?? null)
      onUploaded?.(data.coverImage ?? null)
      toast.success('Cover image updated successfully.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to upload cover image. Please try again.'
      setError(message)
      toast.error(message)
      setSource(null)
    } finally {
      setUploading(false)
    }
  }

  async function handleSelectFromMedia(asset: MediaAsset) {
    if (!mediaSelectUrl) return
    if (applyingMedia) return
    setError(null)
    setApplyingMedia(true)
    try {
      const response = await fetch(mediaSelectUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaAssetId: asset.id }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to apply media asset as cover image.')
      setPreview(data.coverImage ?? null)
      setSource('media')
      onUploaded?.(data.coverImage ?? null)
      setPickerOpen(false)
      toast.success('Cover image updated from Media Library.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to apply media asset as cover image.'
      setError(message)
      toast.error(message)
    } finally {
      setApplyingMedia(false)
    }
  }

  async function handleRemove() {
    setError(null)
    setRemoving(true)
    try {
      const response = await fetch(removeUrl, { method: 'DELETE' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to remove cover image. Please try again.')
      setPreview(null)
      setSource(null)
      onUploaded?.(null)
      toast.success('Cover image removed successfully.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to remove cover image. Please try again.'
      setError(message)
      toast.error(message)
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">{label} <span className="text-muted-foreground">· Optional</span></p>
        <p className="text-xs text-muted-foreground">Wide banner shown at the top of the public broker profile. Recommended: 1600 × 500 px (16:5).</p>
      </div>

      <div className="relative aspect-[16/5] w-full max-w-md overflow-hidden rounded-xl border border-border bg-muted">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={label} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">No cover image</div>
        )}
      </div>

      {source && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
          <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
          {source === 'media' ? 'Selected from Media Library' : 'New upload'}
        </p>
      )}

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-lg border border-primary px-3 py-2 text-sm font-semibold text-primary disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Upload className="h-3.5 w-3.5" aria-hidden="true" />}
          {uploading ? 'Uploading…' : preview ? 'Replace cover' : 'Upload from device'}
        </button>

        {mediaSelectUrl && (
          <button
            type="button"
            disabled={busy}
            onClick={() => { setError(null); setPickerOpen(true) }}
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {applyingMedia ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />}
            {applyingMedia ? 'Applying…' : 'Choose from Media'}
          </button>
        )}

        {preview && (
          <button
            type="button"
            disabled={busy}
            onClick={handleRemove}
            className="rounded-lg border border-destructive px-3 py-2 text-sm font-semibold text-destructive disabled:opacity-50"
          >
            {removing ? 'Removing…' : 'Remove'}
          </button>
        )}
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFile} />
      </div>

      {mediaSelectUrl && (
        <MediaPickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onSelect={(asset) => void handleSelectFromMedia(asset)}
          selectedAssetId={null}
          title="Select Cover Image"
          description="Choose an existing image from the Media Library. The asset is applied directly — it is not re-uploaded."
        />
      )}
    </div>
  )
}