import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

export function BrokerCardSkeleton({ count = 6, view = 'grid' }: { count?: number; view?: 'grid' | 'list' }) {
  return (
    <div
      className={cn(
        'grid gap-6',
        view === 'grid'
          ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
          : 'grid-cols-1',
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} view={view} />
      ))}
    </div>
  )
}

function SkeletonCard({ view }: { view: 'grid' | 'list' }) {
  if (view === 'list') {
    return (
      <div className="flex items-center gap-6 rounded-2xl border border-border p-6">
        <Skeleton className="h-24 w-24 flex-shrink-0 rounded-xl" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-full" />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-8 w-20 rounded-full" />
            <Skeleton className="h-8 w-24 rounded-full" />
          </div>
        </div>
        <Skeleton className="h-10 w-10 rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>

      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />

      <div className="flex gap-2 pt-2">
        <Skeleton className="h-7 w-16 rounded-full" />
        <Skeleton className="h-7 w-20 rounded-full" />
      </div>

      <Skeleton className="h-4 w-1/3" />

      <div className="flex items-center justify-between pt-4 border-t">
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
    </div>
  )
}
