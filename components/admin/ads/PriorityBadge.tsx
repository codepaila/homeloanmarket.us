'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const priorityLabels: Record<number, string> = {
  1: 'Highest',
  2: 'High',
  3: 'Medium-High',
  4: 'Medium',
  5: 'Medium-Low',
  6: 'Low',
  7: 'Lower',
  8: 'Lowest',
  9: 'Very Low',
  10: 'Lowest',
}

interface PriorityBadgeProps {
  priority: number
  className?: string
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const label = priorityLabels[priority] || `P${priority}`

  let variant: 'default' | 'secondary' | 'outline' | 'destructive' = 'outline'
  if (priority <= 2) variant = 'destructive'
  else if (priority <= 4) variant = 'default'
  else if (priority <= 6) variant = 'secondary'

  return (
    <Badge variant={variant} className={cn('font-normal text-xs', className)}>
      {label}
    </Badge>
  )
}
