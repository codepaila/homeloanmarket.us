/* eslint-disable @typescript-eslint/no-explicit-any */
// components/layout/SubscriptionBadge.tsx
import { Badge } from '@/components/ui/badge'
import { cn } from '@/utils'
import { CheckCircle, XCircle, Clock, Crown } from 'lucide-react'

interface SubscriptionBadgeProps {
  user: any
}

export function SubscriptionBadge({ user }: SubscriptionBadgeProps) {
  if (user.role === 'BORROWER' || user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
    return null
  }

  if (user.role === 'BROKER') {
    const isActive = user.hasActiveSubscription
    const isPremium = user.isPremiumBroker
    const isVerified = user.isVerifiedBroker

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
            {user.subscriptionPlan}
          </Badge>
        ) : (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Inactive
          </Badge>
        )}

        {isVerified ? (
          <Badge variant="default" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            Verified
          </Badge>
        ) : (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        )}

        {user.brokerProfile?.featuredListing && (
          <Badge variant="secondary" className="bg-gradient-to-r from-purple-500 to-pink-500">
            Featured
          </Badge>
        )}
      </div>
    )
  }

  return null
}