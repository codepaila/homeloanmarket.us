import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

// Mortgage Expert qualification visual: exactly five green stars followed by
// the "Mortgage Expert" label. The stars are a qualification indicator, not a
// customer rating — they are never derived from reviews, ratings, or counts.
// The effective qualification is always computed server-side and consumed here
// as a plain boolean.
const STARS = [0, 1, 2, 3, 4]

export function MortgageExpertBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 whitespace-nowrap', className)}
      title="Mortgage Expert"
    >
      <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true">
        {STARS.map((index) => (
          <Star key={index} className="h-3 w-3 fill-current" />
        ))}
      </span>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">
        Mortgage Expert
      </span>
    </span>
  )
}