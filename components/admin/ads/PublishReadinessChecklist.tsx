'use client'

import { CheckCircle2, Circle, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Advertisement } from '@/lib/advertisements/types'

interface PublishReadinessChecklistProps {
  advertisement: Advertisement | null | undefined
  className?: string
}

interface ChecklistItem {
  id: string
  label: string
  check: (ad: Advertisement | null | undefined) => boolean
  severity: 'required' | 'warning'
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: 'title',
    label: 'Title',
    severity: 'required',
    check: (ad) => !!ad?.title && ad.title.trim().length > 0,
  },
  {
    id: 'placement',
    label: 'Placement',
    severity: 'required',
    check: (ad) => !!ad?.placement,
  },
  {
    id: 'type',
    label: 'Type',
    severity: 'required',
    check: (ad) => !!ad?.type,
  },
  {
    id: 'action',
    label: 'Action Type',
    severity: 'required',
    check: (ad) => !!ad?.action,
  },
  {
    id: 'creative',
    label: 'Creative',
    severity: 'required',
    check: (ad) => !!(ad?.desktopMediaId || ad?.creatives?.length || ad?.bannerUrl),
  },
  {
    id: 'schedule',
    label: 'Schedule',
    severity: 'warning',
    check: (ad) => !!(ad?.startDate || ad?.endDate),
  },
  {
    id: 'priority',
    label: 'Priority',
    severity: 'warning',
    check: (ad) => ad?.priority !== undefined && ad?.priority !== null,
  },
  {
    id: 'urls',
    label: 'URLs',
    severity: 'warning',
    check: (ad) => {
      if (!ad?.action) return true
      if (ad.action === 'BANNER_CLICK' || ad.action === 'BANNER_AND_BUTTON') {
        return !!ad.bannerUrl && ad.bannerUrl.trim().length > 0
      }
      if (ad.action === 'BUTTON_ONLY' || ad.action === 'BANNER_AND_BUTTON') {
        return !!ad.buttonUrl && ad.buttonUrl.trim().length > 0
      }
      return true
    },
  },
  {
    id: 'button',
    label: 'Button Configuration',
    severity: 'warning',
    check: (ad) => {
      if (!ad?.action) return true
      if (ad.action === 'BUTTON_ONLY' || ad.action === 'BANNER_AND_BUTTON') {
        return !!ad.buttonLabel && ad.buttonLabel.trim().length > 0
      }
      return true
    },
  },
]

export function PublishReadinessChecklist({ advertisement, className }: PublishReadinessChecklistProps) {
  if (!advertisement) {
    return (
      <Card className={cn('border-dashed', className)}>
        <CardContent className="py-6 text-center">
          <p className="text-sm text-text-muted">Load an advertisement to check readiness</p>
        </CardContent>
      </Card>
    )
  }

  const results = CHECKLIST_ITEMS.map(item => ({
    ...item,
    passed: item.check(advertisement),
  }))

  const requiredPassed = results.filter(r => r.severity === 'required' && r.passed).length
  const requiredTotal = results.filter(r => r.severity === 'required').length
  const warningPassed = results.filter(r => r.severity === 'warning' && r.passed).length
  const warningTotal = results.filter(r => r.severity === 'warning').length

  const allRequiredPassed = requiredPassed === requiredTotal
  const canPublish = allRequiredPassed

  return (
    <Card className={cn('border-border bg-card', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm font-semibold">Publish Readiness</CardTitle>
          <Badge variant={canPublish ? 'default' : 'destructive'} className={canPublish ? 'bg-success text-white' : ''}>
            {canPublish ? 'Ready to Publish' : 'Action Required'}
          </Badge>
        </div>
        <p className="text-xs text-text-muted mt-1">
          {requiredPassed}/{requiredTotal} required checks passed
          {warningTotal > 0 && ` • ${warningPassed}/${warningTotal} recommended`}
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {results.map((item) => (
          <div key={item.id} className="flex items-start gap-2">
            {item.passed ? (
              <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
            ) : (
              <Circle className="h-4 w-4 text-text-muted shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <p className={cn(
                'text-xs font-medium',
                item.passed ? 'text-text-main' : 'text-text-muted'
              )}>
                {item.label}
              </p>
              {!item.passed && (
                <div className="flex items-center gap-1 mt-0.5">
                  <AlertTriangle className="h-3 w-3 text-amber-600" />
                  <span className="text-xs text-amber-600">
                    {item.severity === 'required' ? 'Required' : 'Recommended'}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
