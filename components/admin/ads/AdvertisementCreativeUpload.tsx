'use client'

import { ImageIcon, X } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { MediaSelector } from '@/components/admin/media/MediaSelector'
import type { MediaAsset } from '@/lib/advertisements/types'
import type { CreativeFormatRequirement } from '@/lib/advertisements/requirements'

export function AdvertisementCreativeUpload({
  requirement,
  placement,
  value,
  onChange,
}: {
  requirement: CreativeFormatRequirement
  placement: string
  value?: MediaAsset | null
  onChange: (asset: MediaAsset | null) => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2 rounded-lg border bg-muted/40 p-3">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
            {requirement.label}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Required resolution: <span className="font-semibold text-foreground">{requirement.width} × {requirement.height}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Aspect ratio: <span className="font-semibold text-foreground">{requirement.aspectRatio}</span>
          </p>
        </div>
        {value ? (
          <div className="flex items-center gap-2 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
            {value.fileName}
            <button type="button" onClick={() => { onChange(null); toast.success('Creative removed.') }} className="inline-flex text-destructive">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">Required</span>
        )}
      </div>

      <MediaSelector
        value={value?.id}
        selectedAsset={value}
        onChange={onChange}
        label={`Upload a ${requirement.width} × ${requirement.height} image`}
        description={`This creative requires exactly ${requirement.width} × ${requirement.height} (${requirement.aspectRatio}).`}
        placement={placement}
        format={requirement.format}
        requiredWidth={requirement.width}
        requiredHeight={requirement.height}
      />
    </div>
  )
}
