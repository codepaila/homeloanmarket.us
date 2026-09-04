'use client'

import { Megaphone, FileImage, FolderOpen, Plus, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/design/EmptyState'
import { StatsCard } from '@/components/admin/ads/StatsCard'
import { StatsCardSkeleton } from '@/components/admin/ads/LoadingSkeleton'
import { SectionHeader } from '@/components/admin/ads/SectionHeader'
import { useAdminAdStats } from '@/hooks/useAdminAds'
import type { Advertisement, MediaAsset } from '@/lib/advertisements/types'
import { format } from 'date-fns'

interface StatCardItem {
  title: string
  value: number
  cardIcon?: React.ReactNode
  trend?: string
  trendUp?: boolean
}

export default function AdminAdsOverviewPage() {
  const { stats, isLoading, error } = useAdminAdStats()

  const statCards: StatCardItem[] = [
    { title: 'Total Advertisements', value: stats?.total ?? 0, cardIcon: <Megaphone className="h-6 w-6" /> },
    { title: 'Published', value: stats?.published ?? 0, trend: 'Active', trendUp: true },
    { title: 'Draft', value: stats?.draft ?? 0 },
    { title: 'Archived', value: stats?.archived ?? 0 },
    { title: 'Scheduled', value: stats?.scheduled ?? 0 },
    { title: 'Expired', value: stats?.expired ?? 0 },
    { title: 'Impressions', value: stats?.impressions ?? 0 },
    { title: 'Clicks', value: stats?.clicks ?? 0 },
    { title: 'CTR', value: stats?.ctr === undefined || stats?.ctr === null ? 'N/A' : `${stats.ctr}%` },
    { title: 'Total Media Assets', value: stats?.totalMediaAssets ?? 0, cardIcon: <FileImage className="h-6 w-6" /> },
    { title: 'Total Folders', value: stats?.totalFolders ?? 0, cardIcon: <FolderOpen className="h-6 w-6" /> },
  ]

  if (error) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="Advertisement Overview"
          description="Monitor your advertisement campaigns and performance"
        />
        <EmptyState
          title="Failed to load dashboard"
          description={error.message || 'An error occurred while fetching dashboard data.'}
          action={
            <Button onClick={() => window.location.reload()}>
              Retry
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Advertisement Overview"
        description="Monitor your advertisement campaigns and performance"
        actionLabel="New Advertisement"
        actionHref="/admin/ads/list"
      />

      {/* Stats Grid */}
      <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <StatsCardSkeleton key={i} />
            ))
          : statCards.map((stat, i) => (
              <StatsCard
                key={i}
                title={stat.title}
                value={stat.value}
                cardIcon={stat.cardIcon}
                trend={stat.trend}
                trendUp={stat.trendUp}
              />
            ))}
      </div>

      {/* Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Advertisements */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold">Recent Advertisements</CardTitle>
                <CardDescription>Latest 5 advertisements created</CardDescription>
              </div>
              <Link href="/admin/ads/list">
                <Button variant="ghost" size="sm">
                  View All
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-md shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : stats?.recentAds && stats.recentAds.length > 0 ? (
              <div className="space-y-4">
                {stats.recentAds.slice(0, 5).map((ad: Advertisement) => (
                  <Link
                    key={ad.id}
                    href={`/admin/ads/list`}
                    className="flex items-center gap-4 p-3 rounded hover:bg-muted/50 transition-colors"
                  >
                     <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center overflow-hidden shrink-0">
                       {ad.desktopMedia?.thumbnailUrl || ad.desktopMedia?.fileUrl ? (
                         <>
                           {/* eslint-disable-next-line @next/next/no-img-element */}
                           <img
                             src={ad.desktopMedia?.thumbnailUrl || ad.desktopMedia?.fileUrl}
                             alt={ad.title || 'Advertisement'}
                             className="h-full w-full object-cover"
                           />
                         </>
                       ) : (
                         <Megaphone className="h-4 w-4 text-muted-foreground" />
                       )}
                     </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{ad.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(ad.createdAt), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No advertisements yet"
                description="Create your first advertisement to see it here."
                size="sm"
              />
            )}
          </CardContent>
        </Card>

        {/* Recent Uploads */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold">Recent Uploads</CardTitle>
                <CardDescription>Latest media assets uploaded</CardDescription>
              </div>
              <Link href="/admin/media">
                <Button variant="ghost" size="sm" disabled>
                  View All
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-md shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : stats?.recentUploads && stats.recentUploads.length > 0 ? (
              <div className="space-y-4">
                {stats.recentUploads.slice(0, 5).map((asset: MediaAsset) => (
                  <div
                    key={asset.id}
                    className="flex items-center gap-4 p-3 rounded hover:bg-muted/50 transition-colors"
                  >
                    <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center overflow-hidden shrink-0">
                      {asset.thumbnailUrl || asset.fileUrl ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={asset.thumbnailUrl || asset.fileUrl}
                            alt={asset.title || asset.fileName}
                            className="h-full w-full object-cover"
                          />
                        </>
                      ) : (
                        <FileImage className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {asset.title || asset.originalName || asset.fileName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(asset.createdAt), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No media assets yet"
                description="Upload media assets to see them here."
                size="sm"
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
          <CardDescription>Common tasks to get you started</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/admin/ads/list">
              <Button variant="outline" className="w-full justify-start h-auto py-4">
                <Megaphone className="mr-3 h-5 w-5" />
                <div className="text-left">
                  <p className="font-medium">Manage Ads</p>
                  <p className="text-xs text-muted-foreground">View and edit all ads</p>
                </div>
              </Button>
            </Link>
            <Link href="/admin/media">
              <Button variant="outline" className="w-full justify-start h-auto py-4">
                <FileImage className="mr-3 h-5 w-5" />
                <div className="text-left">
                  <p className="font-medium">Media Library</p>
                  <p className="text-xs text-muted-foreground">Browse and manage uploaded assets</p>
                </div>
              </Button>
            </Link>
            <Link href="/admin/folders">
              <Button variant="outline" className="w-full justify-start h-auto py-4">
                <FolderOpen className="mr-3 h-5 w-5" />
                <div className="text-left">
                  <p className="font-medium">Folders</p>
                  <p className="text-xs text-muted-foreground">Organize media folders</p>
                </div>
              </Button>
            </Link>
            <Link href="/admin/ads/new">
              <Button variant="outline" className="w-full justify-start h-auto py-4">
                <Plus className="mr-3 h-5 w-5" />
                <div className="text-left">
                  <p className="font-medium">Create Ad</p>
                  <p className="text-xs text-muted-foreground">Create a new advertisement</p>
                </div>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
