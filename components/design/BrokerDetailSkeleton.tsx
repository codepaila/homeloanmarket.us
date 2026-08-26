import Link from 'next/link'
import { cn } from '@/lib/utils'
import { SkeletonSubtle, SkeletonHeading } from '@/components/ui/skeleton'

/**
 * Loading placeholder for the public broker detail page.
 *
 * Geometry mirrors BrokerDetailClient's server-rendered layout — breadcrumb,
 * rounded cover banner, overlapping square avatar, profile header, contact
 * list, and the closing directory prompt — using the same spacing system so
 * the real profile replaces this skeleton without visible layout shift.
 *
 * Color hierarchy: primary/50 only for the broker name, section headings,
 * and the directory-prompt heading; every other placeholder uses the muted
 * surface. The "Similar brokers" rail is intentionally omitted because it is
 * fetched client-side after hydration and absent from the initial render.
 */
export function BrokerDetailSkeleton({ className }: { className?: string }) {
  return (
    <div role="status" aria-label="Loading mortgage originator profile" aria-busy="true" className={cn('min-h-screen bg-background', className)}>
      {/* Breadcrumb — real items with a placeholder for the broker name */}
      <nav aria-label="Breadcrumb" className="mx-auto max-w-7xl px-4 pt-4">
        <ol aria-hidden="true" className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <li>Home</li>
          <li className="text-muted-foreground/60">/</li>
          <li>
            <Link href="/brokers" className="hover:text-primary">Find Brokers</Link>
          </li>
          <li className="text-muted-foreground/60">/</li>
          <li>
            <SkeletonSubtle className="h-4 w-28 align-middle" />
          </li>
        </ol>
      </nav>

      {/* Cover banner + overlapping avatar */}
      <section aria-hidden="true" className="relative">
        <SkeletonSubtle className="h-48 w-full rounded-b-3xl md:h-72 lg:h-80" />
        <div className="absolute left-1/2 -bottom-16 -translate-x-1/2 md:left-8 md:translate-x-0">
          {/* 128px square, same border/shadow treatment as the real avatar frame */}
          <SkeletonSubtle className="h-32 w-32 rounded border-2 border-background shadow-large" />
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4">
        {/* Profile header: name (primary/50) + NMLS + company; centered on
            mobile, left-aligned on desktop like the real header */}
        <header aria-hidden="true" className="mt-20 text-center md:text-left">
          <div className="flex flex-col items-center md:items-start">
            <SkeletonHeading className="h-9 w-64 max-w-full md:h-10" />
            <SkeletonSubtle className="mt-1.5 h-5 w-32" />
            <SkeletonSubtle className="mt-1 h-7 w-52 max-w-full" />
          </div>
        </header>

        {/* Contact section: heading (primary/50) + divided rows */}
        <div aria-hidden="true" className="mt-8 grid grid-cols-1">
          <aside className="space-y-8 lg:self-start">
            <section className="space-y-4">
              <SkeletonHeading className="h-6 w-24" />
              <div className="divide-y divide-border border-y border-border">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3 py-3">
                    <SkeletonSubtle className="mt-0.5 h-5 w-5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <SkeletonSubtle className="h-3 w-16" />
                      <SkeletonSubtle className="mt-1.5 h-4 w-40 max-w-full" />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Social Profiles: heading (primary/50) + wrapping platform pills,
                mirroring the real SocialSection geometry on the loaded page */}
            <section className="space-y-4">
              <SkeletonHeading className="h-6 w-32" />
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <SkeletonSubtle key={i} className="h-9 w-24 rounded-lg" />
                ))}
              </div>
            </section>
          </aside>
        </div>

        {/* Directory prompt: heading (primary/50) + line + CTA zone */}
        <section aria-hidden="true">
          <div className="px-6 py-14 text-center md:py-16">
            <SkeletonHeading className="mx-auto h-7 w-72 max-w-full md:h-9" />
            <SkeletonSubtle className="mx-auto mt-3 h-4 w-80 max-w-full" />
            <div className="mt-8 flex justify-center">
              <SkeletonSubtle className="h-12 w-56 max-w-full rounded-xl" />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
