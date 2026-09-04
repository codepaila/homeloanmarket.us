'use client'

import { cn } from '@/lib/utils'
import { motion } from 'motion/react'

interface StatCardProps {
  value: string | number
  label: string
  icon?: React.ReactNode
  subvalue?: string
  trend?: 'up' | 'down' | 'neutral'
  className?: string
}

export function StatCard({
  value,
  label,
  icon,
  subvalue,
  trend = 'neutral',
  className,
}: StatCardProps) {
  const trendColors = {
    up: 'text-success',
    down: 'text-destructive',
    neutral: 'text-muted-foreground',
  }

  return (
    <motion.div
      className={cn(
        'group relative overflow-hidden rounded border border-border',
        'bg-card/80 backdrop-blur-sm',
        'p-6 transition-all duration-300',
        'hover:shadow-medium hover:-translate-y-0.5',
        className,
      )}
      whileHover={{ y: -2 }}
    >
      <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="relative flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <div className="text-3xl md:text-4xl font-bold text-foreground">
            {value}
          </div>
          {subvalue && (
            <p className={cn('text-sm font-medium', trendColors[trend])}>
              {subvalue}
            </p>
          )}
        </div>

        {icon && (
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
            {icon}
          </div>
        )}
      </div>
    </motion.div>
  )
}

export function StatsGrid({
  stats,
  className,
}: {
  stats: StatCardProps[]
  className?: string
}) {
  return (
    <div
      className={cn(
        'grid gap-4 sm:gap-6',
        'sm:grid-cols-2 lg:grid-cols-4',
        className,
      )}
    >
      {stats.map((stat, index) => (
        <StatCard key={index} {...stat} />
      ))}
    </div>
  )
}
