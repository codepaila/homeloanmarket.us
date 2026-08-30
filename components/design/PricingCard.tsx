'use client'

import { cn } from '@/lib/utils'
import { motion } from 'motion/react'
import { Check, Star, Zap } from 'lucide-react'

interface PricingCardProps {
  name: string
  description: string
  price: number
  priceSuffix?: string
  features: string[]
  limits?: Record<string, boolean | string | number>
  stripePriceId?: string
  isCurrent?: boolean
  isPopular?: boolean
  onSelect?: (priceId: string, planName: string) => void
  className?: string
}

export function PricingCard({
  name,
  description,
  price,
  priceSuffix = '/month',
  features,
  limits,
  stripePriceId,
  isCurrent,
  isPopular,
  onSelect,
  className,
}: PricingCardProps) {
  return (
    <motion.div
      className={cn(
        'relative flex flex-col rounded-2xl border bg-card/80 p-8',
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

      <div className="mb-6 space-y-3">
        {features.map((feature, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-success">
              <Check className="h-3 w-3" />
            </div>
            <span className="text-sm text-muted-foreground">{feature}</span>
          </div>
        ))}
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
          <div className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-border bg-muted/50 text-sm font-medium text-muted-foreground">
            Current Plan
          </div>
        ) : (
          <motion.button
            onClick={() => (stripePriceId || price === 0) && onSelect?.(stripePriceId || '', name)}
            disabled={!stripePriceId && price !== 0}
            className={cn(
              'w-full rounded-xl py-2.5 text-sm font-semibold transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
              'disabled:opacity-50',
              name === 'FEATURED'
                 ? 'bg-primary text-white hover:bg-primary/90'
                 : 'bg-accent text-accent-foreground hover:bg-primary',
            )}
            whileTap={{ scale: 0.98 }}
          >
            {price === 0 ? 'Create Account' : 'Upgrade'}
          </motion.button>
        )}
      </div>
    </motion.div>
  )
}
