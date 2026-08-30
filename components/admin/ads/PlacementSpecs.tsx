'use client'

import { Image, FileType2, Ruler, Crop, HardDrive, Zap, Monitor, Lightbulb } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getPlacementInfo, type PlacementKey } from './placementPreviews'
import { cn } from '@/lib/utils'

interface PlacementSpecsProps {
  placement: string | undefined
  className?: string
}

export function PlacementSpecs({ placement, className }: PlacementSpecsProps) {
  if (!placement) {
    return (
      <Card className={cn('border-dashed', className)}>
        <CardContent className="py-6 text-center">
          <p className="text-sm text-muted-foreground">Select a placement to see specifications</p>
        </CardContent>
      </Card>
    )
  }

  const info = getPlacementInfo(placement as PlacementKey)

  if (!info) {
    return null
  }

  const { specs } = info
  const isFullWidthTop = specs.maxDisplayHeight !== undefined
  const displayHeight = specs.displayHeight

  return (
    <Card className={cn('border-border bg-card', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Ruler className="h-4 w-4 text-primary" />
          Media Requirements
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <SpecItem icon={Image} label="Recommended" value={`${specs.recommendedWidth} × ${specs.recommendedHeight} px`} />
          <SpecItem icon={Crop} label="Aspect Ratio" value={`${specs.aspectRatio}${isFullWidthTop ? ' horizontal' : ''}`} />
          <SpecItem icon={Monitor} label="Display Height" value={
            displayHeight
              ? isFullWidthTop
                ? `Max ${specs.maxDisplayHeight}px on desktop`
                : `Desktop ${displayHeight.desktop}px`
              : 'Slot-controlled'
          } />
          <SpecItem icon={HardDrive} label="Max Upload Size" value={specs.maxFileSize} />
          <SpecItem icon={FileType2} label="Formats" value={specs.formats.join(', ')} />
          <SpecItem icon={Zap} label="Quality" value={specs.quality} />
        </div>

        {isFullWidthTop && (
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Lightbulb className="h-3.5 w-3.5 text-primary" />
              Tips for a full-width banner
            </p>
            <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              <li>Use a wide horizontal creative for the best fit</li>
              <li>Keep important text and logos inside the safe area</li>
              <li>Avoid tall artwork — it will be scaled to fit</li>
              <li>Do not upload unnecessarily tall creatives</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface SpecItemProps {
  icon: React.ElementType
  label: string
  value: string
}

function SpecItem({ icon: Icon, label, value }: SpecItemProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3 w-3" />
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-sm font-medium">{value}</p>
    </div>
  )
}
