'use client'

import { useId } from 'react'
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { GrowthPoint } from '@/lib/admin/dashboard'
import { DashboardEmptyState } from './DashboardEmptyState'

export function SubscriptionGrowthChart({ all, featured }: { all: GrowthPoint[]; featured: GrowthPoint[] }) {
  const gradientId = useId().replace(/:/g, '')
  const rows = all.map((point, index) => ({
    name: point.key,
    all: point.value,
    featured: featured[index]?.value ?? 0,
  }))
  const hasData = rows.some((row) => row.all + row.featured > 0)

  if (!hasData) {
    return <DashboardEmptyState message="No monthly subscription growth data is available yet." />
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={rows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id={`all-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#9333ea" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#9333ea" stopOpacity={0} />
          </linearGradient>
          <linearGradient id={`featured-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip />
        <Legend />
        <Area isAnimationActive={false} type="monotone" dataKey="all" name="All subscriptions" stroke="#9333ea" strokeWidth={2} fill={`url(#all-${gradientId})`} />
        <Area isAnimationActive={false} type="monotone" dataKey="featured" name="FEATURED" stroke="#f59e0b" strokeWidth={2} fill={`url(#featured-${gradientId})`} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
