'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Check, Star, AlertCircle, RefreshCw } from 'lucide-react'

type PublicPlan = {
  id: string
  code: string
  name: string
  description: string | null
  price: number // cents
  currency: string
  billingInterval: string
  displayOrder: number
  stripePriceId: string | null
  features: string[]
}

interface SubscriptionPlansProps {
  currentPlan: string
  onSelectPlan: (priceId: string, planCode: string) => void
  subscriptionStatus?: string
  plans: PublicPlan[]
  isLoading?: boolean
  error?: unknown
  onRetry?: () => void
}

function PlanCardSkeleton() {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="mx-auto h-6 w-32 animate-pulse rounded bg-muted" />
        <div className="mx-auto mt-3 h-4 w-40 animate-pulse rounded bg-muted" />
        <div className="mx-auto mt-4 h-8 w-24 animate-pulse rounded bg-muted" />
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-4 w-full animate-pulse rounded bg-muted" />
          ))}
        </div>
      </CardContent>
      <CardFooter>
        <div className="h-10 w-full animate-pulse rounded bg-muted" />
      </CardFooter>
    </Card>
  )
}

export default function SubscriptionPlans({
  currentPlan,
  onSelectPlan,
  plans,
  isLoading,
  error,
  onRetry,
}: SubscriptionPlansProps) {
  const [pendingCode, setPendingCode] = useState<string | null>(null)

  const handleSelect = (plan: PublicPlan) => {
    if (!plan.stripePriceId && plan.price !== 0) return
    setPendingCode(plan.code)
    Promise.resolve(onSelectPlan(plan.stripePriceId || '', plan.code)).catch(() =>
      setPendingCode(null),
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground">Plans &amp; Pricing</h2>
          <p className="mt-1 text-sm text-muted-foreground">Loading available plans…</p>
        </div>
        <div className="grid items-start gap-6 md:grid-cols-2">
          <PlanCardSkeleton />
          <PlanCardSkeleton />
        </div>
      </div>
    )
  }

  if (error) {
    const message =
      error && typeof error === 'object' && 'message' in error
        ? String((error as { message: unknown }).message)
        : 'Unable to load subscription plans.'
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center">
        <AlertCircle className="mx-auto h-6 w-6 text-destructive" />
        <p className="mt-2 text-sm font-medium text-foreground">
          We couldn&apos;t load subscription plans.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{message}</p>
        {onRetry && (
          <Button variant="outline" className="mt-4 gap-2" onClick={onRetry}>
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        )}
      </div>
    )
  }

  if (!plans || plans.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No broker subscription plans are currently available. Please check back later or contact
          support.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground">Plans &amp; Pricing</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose the plan that fits your mortgage brokerage needs.
        </p>
      </div>

      <div className="grid items-start gap-6 md:grid-cols-2">
        {plans.map((plan) => {
          const isCurrentPlan = currentPlan === plan.code
          const isPopular = plan.code === 'FEATURED'
          const isFree = plan.price === 0
          const isPending = pendingCode === plan.code

          return (
            <Card
              key={plan.id}
              className={`relative flex flex-col ${
                isCurrentPlan ? 'border border-primary/40 ring-2 ring-primary/20' : ''
              } ${isPopular ? 'border border-yellow-500/60' : ''}`}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge
                    variant="secondary"
                    className="bg-gradient-to-r from-yellow-500 to-orange-500 px-3 py-1"
                  >
                    <Star className="h-3 w-3 mr-1" />
                    Most Popular
                  </Badge>
                </div>
              )}

              <CardHeader>
                <div className="text-center">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  {isCurrentPlan && (
                    <Badge
                      variant="outline"
                      className="mt-2 border-primary/40 text-primary"
                    >
                      Current Plan
                    </Badge>
                  )}
                  <CardDescription className="mt-2">{plan.description}</CardDescription>
                  <div className="mt-4">
                    <div className="text-4xl font-bold">
                      ${(plan.price / 100).toFixed(2)}
                      <span className="text-lg text-muted-foreground">
                        /{plan.billingInterval}
                      </span>
                    </div>
                    {isFree && (
                      <div className="mt-1 text-sm text-muted-foreground">
                        No credit card required
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex-1">
                <Separator className="mb-4" />
                <h4 className="mb-3 text-sm font-medium text-muted-foreground">Features</h4>
                <ul className="space-y-2">
                  {plan.features.length > 0 ? (
                    plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-sm text-muted-foreground">No additional features</li>
                  )}
                </ul>
              </CardContent>

              <CardFooter className="mt-auto">
                {isCurrentPlan ? (
                  <Button variant="outline" className="w-full cursor-default" disabled>
                    Current Plan
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleSelect(plan)}
                    disabled={(!plan.stripePriceId && !isFree) || isPending}
                    className={`w-full gap-2 ${
                      isPopular
                        ? 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600'
                        : ''
                    }`}
                  >
                    {isPending ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : isFree ? (
                      'Get Started'
                    ) : (
                      'Upgrade'
                    )}
                  </Button>
                )}
              </CardFooter>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
