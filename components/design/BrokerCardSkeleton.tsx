import { cn } from '@/lib/utils'
import { SkeletonSubtle, SkeletonHeading } from '@/components/ui/skeleton'

/**
 * Loading placeholders mirroring the public broker pages.
 *
 * Geometry is copied from the production components — the `/brokers` page
 * (discovery header, sticky search toolbar, results grid) and
 * `BrokerGridCard` (components/brokers/BrokerGridCard.tsx) — so cards keep
 * their exact dimensions and the page does not shift when real broker
 * content replaces the skeleton.
 */

// Per-card width variations so a grid of placeholders reads as distinct
// content lines rather than identical bars.
const WIDTH_VARIANTS = [
  { name: 'w-32', company: 'w-44', nmls: 'w-24', badge: 'w-32' },
  { name: 'w-40', company: 'w-36', nmls: 'w-28', badge: 'w-28' },
  { name: 'w-28', company: 'w-40', nmls: 'w-20', badge: 'w-24' },
] as const

// Single-card placeholder with the same box, padding, avatar size, and text
// stack as BrokerGridCard (rounded card, p-3, 96px square avatar, name /
// company / NMLS / badge rows, chevron zone at right center).
export function BrokerGridCardSkeleton({ className, variant = 0 }: { className?: string; variant?: number }) {
  const widths = WIDTH_VARIANTS[variant % WIDTH_VARIANTS.length]
  return (
    <div
      aria-hidden="true"
      className={cn('relative flex h-full flex-col rounded border border-border bg-card p-3', className)}
    >
      {/* Chevron indicator zone (absolute, right center in the real card) */}
      <span className="absolute right-4 top-[50%] -translate-x-1/2 -translate-y-1/2">
        <SkeletonSubtle className="h-5 w-5 rounded-full" />
      </span>

      <div className="flex items-start gap-4">
        {/* Avatar — same 96px square footprint as BrokerAvatar h-24 w-24 */}
        <SkeletonSubtle className="h-24 w-24 shrink-0 border border-border" />

        <div className="min-w-0 flex-1 space-y-1">
          {/* Name — text-base md:text-lg bold line */}
          <SkeletonHeading className={cn('h-6 md:h-7', widths.name)} />
          {/* Company — text-sm line */}
          <SkeletonSubtle className={cn('h-5 max-w-full', widths.company)} />
          {/* NMLS — reserved space for the "NMLS #" line (text-xs) */}
          <SkeletonSubtle className={cn('h-4', widths.nmls)} />
          {/* Badge row — Mortgage Expert badge zone (row always renders) */}
          <div className="flex items-center gap-1.5">
            <SkeletonSubtle className={cn('h-3.5', widths.badge)} />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Results-grid placeholder matching the real grid exactly:
 * grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 with gap-6 (grid view),
 * single column (list view).
 */
export function BrokerCardSkeleton({ count = 6, view = 'grid' }: { count?: number; view?: 'grid' | 'list' }) {
  return (
    <div
      role="status"
      aria-label="Loading mortgage originators"
      aria-busy="true"
      className={cn(
        'grid gap-6',
        view === 'grid'
          ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
          : 'grid-cols-1',
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <BrokerGridCardSkeleton key={i} variant={i} />
      ))}
    </div>
  )
}

/**
 * Full-page listing skeleton mirroring `/brokers`: discovery header
 * (title + subtitle), sticky search/filter toolbar, then the results grid.
 * Spacing classes are copied from the real page.
 */
export function BrokerListingSkeleton({ count = 9 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading mortgage originators" aria-busy="true" className="min-h-screen bg-background">
      {/* Discovery header */}
      <section aria-hidden="true" className="relative overflow-hidden border-b border-border bg-surface py-8 md:py-10">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/5 blur-3xl" />
        <div className="container-custom relative">
          <div className="mx-auto max-w-3xl text-center">
            <SkeletonHeading className="mx-auto h-8 w-80 max-w-full md:h-10 lg:h-12" />
            <SkeletonSubtle className="mx-auto mt-3 h-5 w-72 max-w-full md:h-6" />
          </div>
        </div>
      </section>

      {/* Sticky search + toolbar */}
      <section aria-hidden="true" className="sticky top-16 z-30 border-b border-border bg-card/80 backdrop-blur-lg md:top-[72px]">
        <div className="container-custom grid grid-cols-5 items-center gap-3 py-4 md:gap-5 md:py-5">
          <div className="col-span-4 sm:col-span-3">
            <SkeletonSubtle className="h-10 w-full rounded-xl" />
          </div>
          <div className="col-span-1 hidden sm:block">
            <SkeletonSubtle className="h-4 w-16" />
          </div>
          <div className="col-span-1 flex justify-end">
            <SkeletonSubtle className="h-9 w-12 rounded-lg sm:w-24" />
          </div>
        </div>
      </section>

      {/* Results */}
      <section aria-hidden="true" className="py-8 md:py-12">
        <div className="container-custom">
          <BrokerCardSkeleton count={count} />
        </div>
      </section>
    </div>
  )
}
