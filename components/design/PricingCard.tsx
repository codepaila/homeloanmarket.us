'use client'

import { cn } from '@/lib/utils'
import { motion } from 'motion/react'
import { Check, Star, ChevronDown, ChevronUp } from 'lucide-react'
import { useState, useEffect } from 'react'

interface PricingCardProps {
  name: string
  description: string
  price: number
  priceSuffix?: string
  features: string[]
  limits?: Record<string, boolean | string | number>
  stripePriceId?: string
  code?: string
  isCurrent?: boolean
  isPopular?: boolean
  onSelect?: (priceId: string, planName: string, planCode?: string) => void
  className?: string
  initialVisibleFeatures?: number
}

export function PricingCard({
  name,
  description,
  price,
  priceSuffix = '/month',
  features,
  limits,
  stripePriceId,
  code,
  isCurrent,
  isPopular,
  onSelect,
  className,
  initialVisibleFeatures = 4,
}: PricingCardProps) {
  const [showAllFeatures, setShowAllFeatures] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768) // 768px is the standard md breakpoint
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // On desktop, show all features; on mobile, respect the toggle state
  const shouldShowAll = !isMobile || showAllFeatures
  const hasMoreThanInitial = features.length > initialVisibleFeatures && isMobile
  const visibleFeatures = shouldShowAll 
    ? features 
    : features.slice(0, initialVisibleFeatures)
  
  const hiddenCount = features.length - initialVisibleFeatures

  return (
    <motion.div
      className={cn(
        'relative flex flex-col rounded border bg-card/80 p-4',
        'backdrop-blur-sm transition-all duration-300',
        'hover:border-primary/30 hover:shadow-medium',
        isCurrent &&
          'ring-2 ring-primary/30 border-primary/50',
        isPopular && 'ring-2 ring-amber-500/30',
        className,
      )}
      whileHover={{ y: -4 }}
    >
      {isPopular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-3.5 py-1 text-xs font-semibold text-white">
            <Star className="h-3 w-3 fill-white" />
            Most Popular
          </div>
        </div>
      )}

      <div className="text-center">
        <h3 className="text-xl font-bold text-foreground">{name}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>

        <div className="my-6">
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-4xl font-bold text-foreground">
              ${price}
            </span>
            <span className="text-sm text-muted-foreground">{priceSuffix}</span>
          </div>
          {price === 0 && (
            <p className="mt-1 text-xs text-muted-foreground">No credit card required</p>
          )}
        </div>
      </div>

      <div className="mb-6 space-y-1.5 md:space-y-3">
        {visibleFeatures.map((feature, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-success">
              <Check className="h-3 w-3" />
            </div>
            <span className="text-sm text-muted-foreground">{feature}</span>
          </div>
        ))}
        
        {hasMoreThanInitial && (
          <button
            onClick={() => setShowAllFeatures(!showAllFeatures)}
            className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors mt-1 ml-7 md:hidden"
          >
            {showAllFeatures ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                Show {hiddenCount} more feature{hiddenCount > 1 ? 's' : ''}
              </>
            )}
          </button>
        )}
        
        {/* Optional: Show a subtle indicator on desktop that all features are visible */}
        {/* {!isMobile && features.length > initialVisibleFeatures && (
          <div className="text-xs text-muted-foreground/50 mt-1 ml-7">
            {features.length} features available
          </div>
        )} */}
      </div>

      {limits && (
        <div className="mb-6 space-y-2 text-xs text-muted-foreground">
          {Object.entries(limits).map(([key, value]) => (
            <div key={key} className="flex justify-between">
              <span>{key.replace(/([A-Z])/g, ' $1')}</span>
              <span className="font-medium text-foreground">
                {value === true ? 'Yes' : value === false ? 'No' : String(value)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-auto">
        {isCurrent ? (
          <div className="inline-flex h-11 w-full items-center justify-center rounded border border-border bg-muted/50 text-sm font-medium text-muted-foreground">
            Current Plan
          </div>
        ) : (
          <motion.button
            type="button"
            onClick={() => (stripePriceId || price === 0) && onSelect?.(stripePriceId || '', name, code || name)}
            disabled={!stripePriceId && price !== 0}
            className={cn(
              'w-full rounded py-2.5 text-sm font-semibold transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
              'disabled:opacity-50',
              name === 'FEATURED'
                 ? 'bg-primary text-white hover:bg-primary/90'
                 : 'bg-accent text-accent-foreground hover:bg-primary',
            )}
            whileTap={{ scale: 0.98 }}
          >
            {`Choose ${name}`}
          </motion.button>
        )}
      </div>
    </motion.div>
  )
}