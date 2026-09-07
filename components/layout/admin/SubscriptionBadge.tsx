/* eslint-disable @typescript-eslint/no-explicit-any */
// components/layout/SubscriptionBadge.tsx
import { Badge } from '@/components/ui/badge'
import { cn } from '@/utils'
import { CheckCircle, XCircle, Crown } from 'lucide-react'
import { brokerPlanDisplayName, isPaidBrokerPlan } from '@/lib/broker-plan-display'

interface SubscriptionBadgeProps {
  user: any
}

export function SubscriptionBadge({ user }: SubscriptionBadgeProps) {
  if (user.role === 'BORROWER' || user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
    return null
  }

  if (user.role === 'BROKER') {
    const isActive = user.hasActiveSubscription
    const isVerified = user.isVerifiedBroker
    // Single plan source: the authoritative broker subscription plan derived
    // from the effective subscription resolver (getCurrentUser). No separate
    // code/display mapping is maintained here.
    const planCode = user.subscriptionPlan
    const isPremium = isPaidBrokerPlan(planCode)
    const planLabel = brokerPlanDisplayName(planCode)

    return (
      <div className="flex flex-wrap gap-2">
        {isActive ? (
          <Badge 
            variant={isPremium ? "default" : "outline"} 
            className={cn(
              "gap-1",
              isPremium && "bg-gradient-to-r from-yellow-500 to-orange-500"
            )}
          >
            {isPremium && <Crown className="h-3 w-3" />}
            {planLabel}
          </Badge>
        ) : (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Inactive
          </Badge>
        )}

        {isVerified && (
          <Badge variant="default" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            Verified
          </Badge>
        ) }
      </div>
    )
  }

  return null
}