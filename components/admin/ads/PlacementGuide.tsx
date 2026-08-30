'use client'

import { Info } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getPlacementInfo, type PlacementKey } from './placementPreviews'
import { cn } from '@/lib/utils'

interface PlacementGuideProps {
  placement: string | undefined
  className?: string
}

export function PlacementGuide({ placement, className }: PlacementGuideProps) {
  if (!placement) {
    return (
      <Card className={cn('border-dashed', className)}>
        <CardContent className="py-8 text-center">
          <Info className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Select a placement to see details</p>
        </CardContent>
      </Card>
    )
  }

  const info = getPlacementInfo(placement as PlacementKey)

  if (!info) {
    return null
  }

  return (
    <Card className={cn('border-primary/20 bg-primary/5', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <info.icon className="h-5 w-5 text-primary" />
              {info.label}
            </CardTitle>
            <CardDescription className="mt-1">{info.description}</CardDescription>
          </div>
          <Badge variant="secondary" className="shrink-0">{info.page}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Position</p>
            <p className="font-medium">{info.position}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Visibility</p>
            <p className="font-medium">{info.visibility}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Priority</p>
            <p className="font-medium">{info.priority}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
