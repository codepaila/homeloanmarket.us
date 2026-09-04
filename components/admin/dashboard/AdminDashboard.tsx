'use client'

import type { AdminDashboardData } from '@/lib/admin/dashboard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AdvertisementPerformance } from './AdvertisementPerformance'
import { DashboardEmptyState } from './DashboardEmptyState'
import { DashboardHeader } from './DashboardHeader'
import { DashboardKpiCard } from './DashboardKpiCard'
import { DashboardKpiGrid } from './DashboardKpiGrid'
import { DashboardSection } from './DashboardSection'
import { OperationalActivity } from './OperationalActivity'
import { PlatformGrowthChart } from './PlatformGrowthChart'
import { ProfileViewsCard } from './ProfileViewsCard'
import { SubscriptionGrowthChart } from './SubscriptionGrowthChart'

export function AdminDashboard({ data }: { data: AdminDashboardData }) {
  return (
    <div className="space-y-10">
      <DashboardHeader generatedAt={data.generatedAt} />

      <DashboardKpiGrid
        title="Platform"
        description="Current platform health and reach."
        cards={
          <>
            <DashboardKpiCard label="Total Users" value={data.overview.totalUsers.toLocaleString()} />
            <DashboardKpiCard label="Total Brokers" value={data.overview.totalBrokers.toLocaleString()} />
            <DashboardKpiCard label="Public Eligible Brokers" value={data.overview.activeBrokers.toLocaleString()} />
            <DashboardKpiCard label="Profile Views" value={data.overview.totalProfileViews.toLocaleString()} hint="Total Broker profile views" />
          </>
        }
      />

      <DashboardKpiGrid
        title="Commercial"
        description="Subscription entitlement distribution. FREE is baseline; FEATURED is the paid entitlement."
        cards={
          <>
            <DashboardKpiCard label="Active Subscriptions" value={data.overview.activeSubscriptions.toLocaleString()} />
            <DashboardKpiCard label="FREE" value={data.overview.freeSubscriptions.toLocaleString()} hint="Baseline entitlement" />
            <DashboardKpiCard label="FEATURED" value={data.overview.featuredSubscriptions.toLocaleString()} hint="Active paid entitlement" />
            <DashboardKpiCard label="Revenue" value="N/A" hint="No authoritative payment source" />
          </>
        }
      />

      <DashboardKpiGrid
        title="Operations"
        description="Immediate operational items."
        cards={
          <>
            <DashboardKpiCard label="Pending Claims" value={data.overview.pendingClaims.toLocaleString()} />
            <DashboardKpiCard label="Recent Inquiries (7d)" value={data.overview.recentContacts.toLocaleString()} />
            <DashboardKpiCard label="Published FAQs" value={data.overview.publishedFaqs.toLocaleString()} />
            <DashboardKpiCard label="Draft FAQs" value={data.overview.draftFaqs.toLocaleString()} />
          </>
        }
      />

      <DashboardSection title="Platform Growth" description="Users and brokers created per month (last 12 months).">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">User &amp; Broker Growth</CardTitle>
            <CardDescription>Monthly creation counts from real records.</CardDescription>
          </CardHeader>
          <CardContent>
            <PlatformGrowthChart users={data.userGrowth} brokers={data.brokerGrowth} />
          </CardContent>
        </Card>
      </DashboardSection>

      <DashboardSection title="Subscription Growth" description="All subscriptions and FEATURED subscriptions per month (last 12 months).">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Subscription Creation</CardTitle>
            <CardDescription>Monthly subscription creation counts. PREMIUM is not an active product.</CardDescription>
          </CardHeader>
          <CardContent>
            <SubscriptionGrowthChart all={data.subscriptionGrowth} featured={data.featuredGrowth} />
          </CardContent>
        </Card>
      </DashboardSection>

      <DashboardSection title="Revenue" description="Revenue is intentionally not displayed because the local schema has no authoritative payment amount source.">
        <Card>
          <CardContent className="pt-6">
            <DashboardEmptyState message="Revenue is not derived from subscription counts. Connect an authoritative payment source before displaying this metric." />
          </CardContent>
        </Card>
      </DashboardSection>

      <DashboardSection title="Engagement" description="Profile views and advertisement performance.">
        <div className="grid gap-4 lg:grid-cols-3">
          <ProfileViewsCard data={data.profileViews} />
          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Profile View Distribution</CardTitle>
                <CardDescription>Top viewed Broker profiles by existing counter.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.profileViews.top.length === 0 ? (
                  <DashboardEmptyState message="No profile view data is available." />
                ) : (
                  data.profileViews.top.slice(0, 5).map((broker, index) => (
                    <div key={broker.slug} className="flex items-center justify-between gap-3 rounded border px-3 py-2">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="w-5 shrink-0 text-sm font-semibold text-muted-foreground">{index + 1}</span>
                        <span className="truncate text-sm font-medium">{broker.displayName}</span>
                      </div>
                      <span className="shrink-0 text-sm font-semibold">{broker.views.toLocaleString()}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </DashboardSection>

      <DashboardSection title="Advertising" description="Advertisement performance from existing AdEvent tracking.">
        <AdvertisementPerformance data={data} />
      </DashboardSection>

      <DashboardSection title="Operational Monitoring" description="Recent platform activity from real records.">
        <OperationalActivity data={data.recent} />
      </DashboardSection>
    </div>
  )
}
