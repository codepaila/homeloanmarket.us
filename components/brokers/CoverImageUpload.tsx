'use client'

import { useRef, useState } from 'react'
import { toast } from 'react-hot-toast'
import { Loader2 } from 'lucide-react'

interface CoverImageUploadProps {
  value?: string | null
  uploadUrl: string
  removeUrl: string
  onUploaded?: (url: string | null) => void
  label?: string
}

export function CoverImageUpload({
  value,
  uploadUrl,
  removeUrl,
  onUploaded,
  label = 'Cover image',
}: CoverImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(value || null)
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busy = uploading || removing

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setError(null)
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
    } finally {
      setUploading(false)
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

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-lg border border-primary px-3 py-2 text-sm font-semibold text-primary disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
          {uploading ? 'Uploading…' : preview ? 'Replace cover' : 'Upload cover'}
        </button>
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
    </div>
  )
}
