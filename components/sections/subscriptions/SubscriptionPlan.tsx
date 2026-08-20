'use client'

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Check, Star } from 'lucide-react'

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
  onSelectPlan: (priceId: string, planName: string) => void
  subscriptionStatus: string
  plans: PublicPlan[]
}

export default function SubscriptionPlans({
  currentPlan,
  onSelectPlan,
  plans,
}: SubscriptionPlansProps) {
  if (!plans || plans.length === 0) {
    return <p className="text-center text-sm text-muted-foreground">No plans are currently available.</p>
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground">Choose Your Plan</h2>
        <p className="text-muted-foreground mt-2">
          Select the right plan for your mortgage brokerage needs
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {plans.map((plan) => {
          const isCurrentPlan = currentPlan === plan.code
          const isPopular = plan.code === 'FEATURED'
          const isFree = plan.price === 0

          return (
            <Card
              key={plan.id}
              className={`relative ${isCurrentPlan ? 'border border-primary/20 ring-2 ring-primary/20' : ''} ${
                isPopular ? 'border border-yellow-500' : ''
              }`}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge variant="secondary" className="bg-gradient-to-r from-yellow-500 to-orange-500 px-3 py-1">
                    <Star className="h-3 w-3 mr-1" />
                    Most Popular
                  </Badge>
                </div>
              )}

              <CardHeader>
                <div className="text-center">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription className="min-h-[40px] mt-2">
                    {plan.description}
                  </CardDescription>
                  <div className="mt-4">
                    <div className="text-4xl font-bold">
                      ${(plan.price / 100).toFixed(2)}
                      <span className="text-lg text-muted-foreground">/{plan.billingInterval}</span>
                    </div>
                    {isFree && (
                      <div className="text-sm text-muted-foreground mt-1">No credit card required</div>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <Separator className="mb-4" />
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-muted-foreground">Features:</h4>
                  <ul className="space-y-2">
                    {plan.features.length > 0 ? plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    )) : (
                      <li className="text-sm text-muted-foreground">No additional features</li>
                    )}
                  </ul>
                </div>
              </CardContent>

              <CardFooter>
                {isCurrentPlan ? (
                  <Button
                    variant="outline"
                    className="w-full cursor-default"
                    disabled
                  >
                    Current Plan
                  </Button>
                ) : (
                  <Button
                    onClick={() => plan.stripePriceId && onSelectPlan(plan.stripePriceId, plan.code)}
                    disabled={!plan.stripePriceId && !isFree}
                    className={`w-full gap-2 ${isPopular ? 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600' : ''}`}
                  >
                    {isFree ? 'Create Account' : 'Upgrade'}
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