'use client'

import { Clock, CheckCircle, Edit, Archive, RotateCcw, Trash2, Ban } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Advertisement } from '@/lib/advertisements/types'
import { toISOStringSafe } from '@/lib/admin/advertisement-dto'

interface ActivityTimelineProps {
  advertisement: Advertisement | null | undefined
  metrics?: { impressions: number; clicks: number } | null
  className?: string
}

interface TimelineEvent {
  icon: React.ElementType
  label: string
  date: string | null
  user: string | null
  color: string
}

const STATUS_EVENTS: Record<string, TimelineEvent> = {
  published: {
    icon: CheckCircle,
    label: 'Published',
    date: null,
    user: null,
    color: 'text-success',
  },
  archived: {
    icon: Archive,
    label: 'Archived',
    date: null,
    user: null,
    color: 'text-text-muted',
  },
  restored: {
    icon: RotateCcw,
    label: 'Restored',
    date: null,
    user: null,
    color: 'text-primary',
  },
  disabled: {
    icon: Ban,
    label: 'Disabled',
    date: null,
    user: null,
    color: 'text-amber-600',
  },
  deleted: {
    icon: Trash2,
    label: 'Deleted',
    date: null,
    user: null,
    color: 'text-destructive',
  },
}

export function ActivityTimeline({ advertisement, metrics, className }: ActivityTimelineProps) {
  if (!advertisement) {
    return (
      <Card className={cn('border-dashed', className)}>
        <CardContent className="py-6 text-center">
          <p className="text-sm text-text-muted">Load an advertisement to see activity</p>
        </CardContent>
      </Card>
    )
  }

  const events: TimelineEvent[] = []

  if (advertisement.createdAt) {
    events.push({
      icon: Clock,
      label: 'Created',
      date: toISOStringSafe(advertisement.createdAt),
      user: null,
      color: 'text-text-muted',
    })
  }

  if (advertisement.updatedAt && advertisement.updatedAt !== advertisement.createdAt) {
    events.push({
      icon: Edit,
      label: 'Updated',
      date: toISOStringSafe(advertisement.updatedAt),
      user: null,
      color: 'text-text-muted',
    })
  }

  const currentStatus = advertisement.isArchived
    ? 'archived'
    : advertisement.isEnabled
      ? 'published'
      : 'disabled'

  const statusEvent = STATUS_EVENTS[currentStatus]
  if (statusEvent) {
    events.push({
      ...statusEvent,
      date: toISOStringSafe(advertisement.updatedAt || advertisement.createdAt),
      user: null,
    })
  }

  return (
    <Card className={cn('border-border bg-card', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
          <div className="space-y-4">
            {events.map((event, index) => (
              <div key={index} className="flex items-start gap-3 relative">
                <div className={cn('rounded-full p-1 bg-card z-10', event.color)}>
                  <event.icon className="h-3 w-3" />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className="text-xs font-medium">{event.label}</p>
                  {event.date && (
                    <p className="text-xs text-text-muted mt-0.5">
                      {formatDate(event.date)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-border space-y-2">
          <StatusRow label="Current Status" value={currentStatus} />
          <StatusRow label="Impressions" value={formatNumber(metrics?.impressions || 0)} />
          <StatusRow label="Clicks" value={formatNumber(metrics?.clicks || 0)} />
        </div>
      </CardContent>
    </Card>
  )
}

interface StatusRowProps {
  label: string
  value: string
}

function StatusRow({ label, value }: StatusRowProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-text-muted">{label}</span>
      <Badge variant="secondary" className="text-xs">{value}</Badge>
    </div>
  )
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num)
}
