'use client'

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { AdminDashboardData } from '@/lib/admin/dashboard'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DashboardEmptyState } from './DashboardEmptyState'

export function AdvertisementPerformance({ data }: { data: AdminDashboardData }) {
  const engagement = data.adEngagement
  const rows = engagement.keys.map((key, index) => ({
    name: key,
    impressions: engagement.impressions[index] || 0,
    clicks: engagement.clicks[index] || 0,
  }))
  const hasEngagement = engagement.totalImpressions + engagement.totalClicks > 0

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Advertisement Performance</CardTitle>
          <CardDescription>Impressions and clicks from existing AdEvent tracking (last 30 days).</CardDescription>
        </CardHeader>
        <CardContent>
          {hasEngagement ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={rows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar isAnimationActive={false} dataKey="impressions" name="Impressions" fill="#2563eb" />
                <Bar isAnimationActive={false} dataKey="clicks" name="Clicks" fill="#16a34a" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <DashboardEmptyState message="No advertisement tracking events are available in the selected window." />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Summary</CardTitle>
          <CardDescription>Active advertisements and measured engagement.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Active Advertisements</p>
            <p className="mt-1 text-2xl font-semibold">{data.overview.activeAdvertisements.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Impressions (30d)</p>
            <p className="mt-1 text-2xl font-semibold">{engagement.totalImpressions.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Clicks (30d)</p>
            <p className="mt-1 text-2xl font-semibold">{engagement.totalClicks.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">CTR</p>
            <p className="mt-1 text-2xl font-semibold">{engagement.ctr === null ? 'N/A' : `${engagement.ctr}%`}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Top Advertisements</CardTitle>
          <CardDescription>Ranked by impressions from existing AdEvent tracking.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.topAdvertisements.length === 0 ? (
            <DashboardEmptyState message="No advertisement performance data is available." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Advertisement</th>
                    <th className="py-2 pr-4 font-medium">Placement</th>
                    <th className="py-2 pr-4 text-right font-medium">Impressions</th>
                    <th className="py-2 pr-4 text-right font-medium">Clicks</th>
                    <th className="py-2 text-right font-medium">CTR</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topAdvertisements.map((advertisement) => (
                    <tr key={advertisement.id} className="border-b last:border-0">
                      <td className="max-w-[220px] truncate py-2 pr-4 font-medium">{advertisement.title}</td>
                      <td className="py-2 pr-4">
                        <Badge variant="secondary">{advertisement.placement}</Badge>
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">{advertisement.impressions.toLocaleString()}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{advertisement.clicks.toLocaleString()}</td>
                      <td className="py-2 text-right tabular-nums">{advertisement.ctr === null ? 'N/A' : `${advertisement.ctr}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
