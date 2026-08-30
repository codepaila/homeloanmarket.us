'use client'

import { cn } from '@/lib/utils'

interface StatsCardProps {
  title: string
  value: string | number
  cardIcon: React.ReactNode | undefined | null
  trend?: string | null
  trendUp?: boolean
  className?: string
}

export function StatsCard({ title, value, cardIcon, trend, trendUp, className }: StatsCardProps) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-6 transition-all duration-300 hover:shadow-medium hover:-translate-y-0.5',
        className
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="relative flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="text-3xl md:text-4xl font-bold text-foreground">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </div>
          {trend && (
            <p className={cn('text-sm font-medium', trendUp ? 'text-success' : 'text-destructive')}>
              {trend}
            </p>
          )}
        </div>

        {cardIcon && (
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {cardIcon}
          </div>
        )}
      </div>
    </div>
  )
}
