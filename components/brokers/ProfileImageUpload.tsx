'use client'

import { useRef, useState } from 'react'
import { toast } from 'react-hot-toast'

interface ProfileImageUploadProps {
  value?: string | null
  uploadUrl: string
  removeUrl: string
  onUploaded?: (url: string | null) => void
  label?: string
  helperText?: string
}

export function ProfileImageUpload({
  value,
  uploadUrl,
  removeUrl,
  onUploaded,
  label = 'Profile image',
  helperText = 'Professional broker photo shown on public cards and profile.',
}: ProfileImageUploadProps) {
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
      if (!response.ok) throw new Error(data.message || 'Unable to upload profile image. Please try again.')
      setPreview(data.profileImage ?? null)
      onUploaded?.(data.profileImage ?? null)
      toast.success('Profile image updated successfully.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to upload profile image. Please try again.'
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
      if (!response.ok) throw new Error(data.message || 'Unable to remove profile image. Please try again.')
      setPreview(null)
      onUploaded?.(null)
      toast.success('Profile image removed successfully.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to remove profile image. Please try again.'
      setError(message)
      toast.error(message)
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={label} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs font-medium text-muted-foreground">
            No image
          </div>
        )}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
      </div>

      <div className="flex-1 space-y-2">
        <p className="text-sm font-medium text-text-main">{label}</p>
        <p className="text-sm text-muted-foreground">{helperText}</p>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-label={`${label} file input`}
            onChange={handleFile}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="inline-flex h-9 items-center rounded-lg border border-border bg-background px-3.5 text-sm font-medium text-text-main transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploading ? 'Uploading…' : preview ? 'Change image' : 'Upload image'}
          </button>
          {preview && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={busy}
              className="inline-flex h-9 items-center rounded-lg border border-border px-3.5 text-sm font-medium text-destructive transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              {removing ? 'Removing…' : 'Remove'}
            </button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">JPG, PNG or WebP up to 5 MB</p>

        {error && (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}

export default ProfileImageUpload
