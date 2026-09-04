import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { AdminDashboardData } from '@/lib/admin/dashboard'
import { DashboardEmptyState } from './DashboardEmptyState'

export function ProfileViewsCard({ data }: { data: AdminDashboardData['profileViews'] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Broker Profile Views</CardTitle>
        <CardDescription>Total Broker profile views from the existing counter field.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-3xl font-semibold">{data.total.toLocaleString()}</p>
        {data.top.length === 0 ? (
          <DashboardEmptyState message="No profile view data is available." />
        ) : (
          <ol className="space-y-2">
            {data.top.map((broker, index) => (
              <li key={broker.slug} className="flex items-center justify-between gap-3 rounded border px-3 py-2">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="w-5 shrink-0 text-sm font-semibold text-muted-foreground">{index + 1}</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{broker.displayName}</p>
                    <p className="truncate text-xs text-muted-foreground">{broker.slug}</p>
                  </div>
                </div>
                <span className="shrink-0 text-sm font-semibold">{broker.views.toLocaleString()}</span>
              </li>
            ))}
          </ol>
        )}
        <p className="text-xs text-muted-foreground">
          Historical daily view tracking is not available in the current analytics model.
        </p>
      </CardContent>
    </Card>
  )
}
