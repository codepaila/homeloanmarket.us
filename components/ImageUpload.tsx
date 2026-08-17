'use client'

// components/ImageUpload.tsx
import { useRef, useState } from 'react'
import { toast } from 'react-hot-toast'
import { cn } from '@/lib/utils'

interface ImageUploadProps {
  onChange: (value: string) => void
  value?: string
  type?: 'logo' | 'cover' | 'avatar'
  className?: string
  aspectRatio?: 'square' | 'video' | 'cover'
}

const ImageUpload = ({ onChange, value, type = 'logo', className = '', aspectRatio = 'square' }: ImageUploadProps) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', type)

      const response = await fetch('/api/upload/image', { method: 'POST', body: formData })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to upload image. Please try again.')
      onChange(data.url)
      toast.success(`${getPlaceholder()} uploaded successfully.`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to upload image. Please try again.'
      setError(message)
      toast.error(message)
    } finally {
      setUploading(false)
    }
  }

  const getAspectRatioClass = () => {
    switch (aspectRatio) {
      case 'video': return 'aspect-video'
      case 'cover': return 'aspect-[21/9]'
      default: return 'aspect-square'
    }
  }

  const getDimensions = () => {
    switch (type) {
      case 'logo': return 'w-24 h-24'
      case 'cover': return 'w-full h-48'
      case 'avatar': return 'w-32 h-32'
      default: return 'w-24 h-24'
    }
  }

  const getPlaceholder = () => {
    switch (type) {
      case 'logo': return 'Logo'
      case 'cover': return 'Cover'
      case 'avatar': return 'Avatar'
      default: return 'Image'
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        aria-label={`Upload ${getPlaceholder()}`}
        onChange={handleFileChange}
      />
      <div
        role="button"
        tabIndex={0}
        aria-label={`Upload ${getPlaceholder()}`}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            inputRef.current?.click()
          }
        }}
        className={cn(
          'cursor-pointer border-2 border-dashed border-border rounded-lg overflow-hidden hover:border-primary transition-colors',
          getDimensions(),
          getAspectRatioClass(),
          className,
          'relative',
        )}
      >
        {uploading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
        {value ? (
          <img
            src={value}
            alt={getPlaceholder()}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-muted">
            <div className="mb-2 text-muted-foreground">
              {type === 'logo' ? (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <span className="text-lg font-semibold">L</span>
                </div>
              ) : type === 'cover' ? (
                <div className="flex h-16 w-10 items-center justify-center rounded bg-muted">
                  <span className="text-sm font-semibold">COVER</span>
                </div>
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <span className="text-lg">A</span>
                </div>
              )}
            </div>
            {type === 'cover' && (
              <>
                <span className="text-sm text-muted-foreground">
                  Upload {getPlaceholder()}
                </span>
                <span className="mt-1 text-xs text-muted-foreground">
                  PNG, JPG, WEBP up to 5MB
                </span>
              </>
            )}
          </div>
        )}
        {value && type !== 'cover' && (
          <div className="absolute bottom-2 right-2">
            <div className="rounded bg-primary px-2 py-1 text-xs text-white">
              Change
            </div>
          </div>
        )}
        {value && type === 'cover' && (
          <div className="absolute bottom-4 right-4">
            <div className="rounded-md bg-primary px-3 py-1.5 text-xs text-white">
              Change Cover
            </div>
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

export default ImageUpload
