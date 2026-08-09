import { cn } from '@/lib/utils'
import { Star } from 'lucide-react'

interface RatingStarsProps {
  rating: number
  totalReviews?: number
  size?: 'sm' | 'md' | 'lg'
  showCount?: boolean
  className?: string
  readOnly?: boolean
}

export function RatingStars({
  rating,
  totalReviews = 0,
  size = 'md',
  showCount = true,
  className,
  readOnly = true,
}: RatingStarsProps) {
  const sizeClass = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  }

  const rounded = Math.round(rating)
  const full = Math.floor(rounded)
  const hasHalf = rounded - full >= 0.25 && rounded - full < 0.75

  return (
    <div
      className={cn(
        'flex items-center gap-1.5',
        showCount && 'gap-2',
        className,
      )}
    >
      <div className="flex items-center">
        {[...Array(5)].map((_, i) => {
          if (i < full) {
            return (
              <Star
                key={i}
                className={cn(
                  sizeClass[size],
                  'fill-yellow-400 text-yellow-400',
                )}
              />
            )
          }
          if (i === full && hasHalf) {
            return (
              <div key={i} className={cn('relative', sizeClass[size])}>
                <Star className={cn(sizeClass[size], 'text-muted-foreground/30')} />
                <div className="absolute inset-0 overflow-hidden" style={{ width: '50%' }}>
                  <Star className={cn(sizeClass[size], 'fill-yellow-400 text-yellow-400')} />
                </div>
              </div>
            )
          }
          return (
            <Star
              key={i}
              className={cn(
                sizeClass[size],
                'text-muted-foreground/30',
              )}
            />
          )
        })}
      </div>
      {showCount && totalReviews > 0 && (
        <span className="text-sm text-text-muted">
          ({totalReviews} review{totalReviews !== 1 ? 's' : ''})
        </span>
      )}
    </div>
  )
}

export function RatingBadge({
  rating,
  totalReviews,
  className,
}: {
  rating: number
  totalReviews?: number
  className?: string
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium',
        'text-amber-700 ring-1 ring-amber-600/20',
        'dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/30',
        className,
      )}
    >
      <Star className="h-3 w-3 fill-current text-amber-400" />
      <span>{rating.toFixed(1)}</span>
      {totalReviews !== undefined && totalReviews > 0 && (
        <>
          <span aria-hidden="true">·</span>
          <span>{totalReviews}</span>
        </>
      )}
    </div>
  )
}
