'use client'

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Check, Star, Zap, Headphones, LineChart, Phone, Banknote } from 'lucide-react'
import { subscriptionPlans } from '@/lib/stripe'

interface SubscriptionPlansProps {
  currentPlan: string
  onSelectPlan: (priceId: string, planName: string) => void
  subscriptionStatus: string
}

export default function SubscriptionPlans({ 
  currentPlan, 
  onSelectPlan, 
  subscriptionStatus 
}: SubscriptionPlansProps) {
  const isActive = subscriptionStatus === 'ACTIVE'

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground">Choose Your Plan</h2>
        <p className="text-muted-foreground mt-2">
          Select the right plan for your mortgage brokerage needs
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {subscriptionPlans.map((plan) => {
          const isCurrentPlan = currentPlan === plan.name
          const isPopular = plan.name === 'FEATURED'
          const isFeatured = plan.name === 'FEATURED'
          const isFree = plan.name === 'FREE'

          return (
            <Card 
              key={plan.name}
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

              {isFeatured && !isPopular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10 bg-background">
                  <Badge variant="outline" className="px-3 py-1">
                    <Zap className="h-3 w-3 mr-1" />
                    Recommended
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
                      ${plan.price}
                      <span className="text-lg text-muted-foreground">/month</span>
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
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="pt-4">
                    <h4 className="font-medium text-sm text-muted-foreground mb-2">Key Limits:</h4>
                    <div className="space-y-1 text-sm">
                      {/* <div className="flex justify-between">
                        <span className="text-muted-foreground">Bank Partners:</span>
                        <span className="font-medium">{plan.limits.maxBankPartners}</span>
                      </div> */}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Contact Details:</span>
                        <span className="font-medium">
                          {plan.limits.canShowContact ? 'Shown' : 'Hidden'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Featured Placement:</span>
                        <span className="font-medium">
                          {plan.limits.isFeatured ? 'Yes' : 'No'}
                        </span>
                      </div>
                    </div>
                  </div>
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
                    onClick={() => plan.stripePriceId && onSelectPlan(plan.stripePriceId, plan.name)}
                    disabled={!plan.stripePriceId || (isFree && isCurrentPlan)}
                    className={`w-full gap-2 ${
                      isPopular ? 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600' : ''
                    }`}
                  >
                    {isFree ? 'Create Account' : 'Upgrade'}
                  </Button>
                )}
              </CardFooter>
            </Card>
          )
        })}
      </div>

      {/* Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle>Plan Comparison</CardTitle>
          <CardDescription>
            Compare all features across different plans
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Feature</th>
                  {subscriptionPlans.map(plan => (
                    <th key={plan.name} className="text-center py-3 px-4 font-medium">
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Monthly Price', key: 'price', type: 'price' },
                  { label: 'Bank Partners', key: 'maxBankPartners', type: 'number' },
                  { label: 'Show Contact', icon: Phone, key: 'canShowContact', type: 'boolean' },
                  { label: 'Featured Placement', icon: Star, key: 'isFeatured', type: 'boolean' },
                  { label: 'Priority Support', icon: Headphones, key: 'prioritySupport', type: 'boolean' },
                  { label: 'Advanced Analytics', icon: LineChart, key: 'advancedAnalytics', type: 'boolean' },
                  { label: 'Custom Profile', key: 'customProfile', type: 'boolean' },
                  { label: 'Phone Support', key: 'phoneSupport', type: 'boolean' },
                ].map((feature, index) => (
                  <tr key={index} className="border-t">
                    <td className="py-3 px-4 font-medium">
                      <div className="flex items-center gap-2">
                        {feature.icon && <feature.icon className="h-4 w-4" />}
                        {feature.label}
                      </div>
                    </td>
                    {subscriptionPlans.map(plan => {
                      let value
                      if (feature.key === 'price') {
                        value = `$${plan.price}`
                      } else {
                        value = plan.limits[feature.key as keyof typeof plan.limits]
                      }
                      
                      return (
                        <td key={`${plan.name}-${index}`} className="text-center py-3 px-4">
                          {feature.type === 'boolean' ? (
                            value ? (
                              <Check className="h-5 w-5 text-green-500 mx-auto" />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )
                          ) : feature.type === 'price' ? (
                            <span className="font-semibold">{value}</span>
                          ) : (
                            <span className="font-semibold">{value}</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
