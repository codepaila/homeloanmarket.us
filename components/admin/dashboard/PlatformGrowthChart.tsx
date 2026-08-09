'use client'

import { useId } from 'react'
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { GrowthPoint } from '@/lib/admin/dashboard'
import { DashboardEmptyState } from './DashboardEmptyState'

export function PlatformGrowthChart({ users, brokers }: { users: GrowthPoint[]; brokers: GrowthPoint[] }) {
  const gradientId = useId().replace(/:/g, '')
  const rows = users.map((point, index) => ({
    name: point.key,
    users: point.value,
    brokers: brokers[index]?.value ?? 0,
  }))
  const hasData = rows.some((row) => row.users + row.brokers > 0)

  if (!hasData) {
    return <DashboardEmptyState message="No monthly user or broker growth data is available yet." />
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={rows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id={`users-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
          </linearGradient>
          <linearGradient id={`brokers-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#16a34a" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip />
        <Legend />
        <Area isAnimationActive={false} type="monotone" dataKey="users" name="Users" stroke="#2563eb" strokeWidth={2} fill={`url(#users-${gradientId})`} />
        <Area isAnimationActive={false} type="monotone" dataKey="brokers" name="Brokers" stroke="#16a34a" strokeWidth={2} fill={`url(#brokers-${gradientId})`} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
