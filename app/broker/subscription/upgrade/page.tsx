// app/broker/subscription/upgrade/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  CreditCard,
  ArrowUp,
  ArrowRight,
  Check,
  Zap,
  Star,
  Shield,
  Globe,
  TrendingUp,
  AlertCircle,
  ChevronRight,
  RefreshCw,
  Sparkles,
  Target,
  Award,
  Rocket
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { subscriptionPlans } from '@/lib/stripe'

export default function UpgradePlanPage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [currentPlan, setCurrentPlan] = useState<string>('FREE')
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [comparisonMode, setComparisonMode] = useState(false)
  const [isAnnual, setIsAnnual] = useState(false)

  const fetchCurrentPlan = async () => {
    try {
      const response = await fetch('/api/subscription/details')
      const data = await response.json()

      if (data.success) {
        setCurrentPlan(data.data.plan || 'FREE')
      }
    } catch (error) {
      toast.error('Failed to load subscription details')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/login')
    } else if (sessionStatus === 'authenticated') {
      fetchCurrentPlan()
    }
  }, [sessionStatus, router])

  const getPlanIndex = (planName: string): number => {
    const planNames = ['FREE', 'FEATURED']
    return planNames.indexOf(planName.toUpperCase())
  }

  const isUpgradeAvailable = (planName: string): boolean => {
    const currentIndex = getPlanIndex(currentPlan)
    const targetIndex = getPlanIndex(planName)
    return targetIndex > currentIndex
  }

  const handleUpgrade = async (planName: string) => {
    const plan = subscriptionPlans.find(p => p.name.toUpperCase() === planName)
    if (!plan) return

    try {
      const response = await fetch('/api/subscription/upgrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId: plan.stripePriceId,
          plan: planName,
          isAnnual
        }),
      })

      const data = await response.json()

      if (data.success && data.url) {
        window.location.assign(data.url)
      } else {
        throw new Error(data.error || 'Failed to upgrade plan')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upgrade plan')
      console.error(error)
    }
  }

  if (loading || sessionStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading upgrade options...</p>
        </div>
      </div>
    )
  }

  const getMonthlyPrice = (price: number) => isAnnual ? Math.round(price * 11) : price
  const getPricePeriod = () => isAnnual ? '/year' : '/month'
  const currentPlanConfig = subscriptionPlans.find(p => p.name.toUpperCase() === currentPlan) || subscriptionPlans[0]
  const availablePlans = subscriptionPlans.filter(plan =>
    getPlanIndex(plan.name.toUpperCase()) > getPlanIndex(currentPlan)
  )

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Upgrade Your Plan</h1>
            <p className="text-muted-foreground">
              Choose a plan that fits your growing business needs
            </p>
          </div>
          <Badge variant="outline" className="text-lg px-4 py-2">
            Current: {currentPlanConfig.name}
          </Badge>
        </div>
      </div>

      {/* Billing Toggle */}
      <div className="flex justify-center mb-8">
        <div className="flex items-center gap-4 p-4 border rounded-lg">
          <span className={`text-lg font-medium ${!isAnnual ? 'text-primary' : 'text-muted-foreground'}`}>
            Monthly Billing
          </span>
          <button
            onClick={() => setIsAnnual(!isAnnual)}
            className="relative inline-flex h-8 w-16 items-center rounded-full bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                isAnnual ? 'translate-x-9' : 'translate-x-1'
              }`}
            />
          </button>
          <div>
            <span className={`text-lg font-medium ${isAnnual ? 'text-primary' : 'text-muted-foreground'}`}>
              Annual Billing
            </span>
            <Badge variant="outline" className="ml-2 bg-green-50 text-green-700 border-green-200">
              Save 20%
            </Badge>
          </div>
        </div>
      </div>

      {availablePlans.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <Award className="h-8 w-8 text-success" />
            </div>
            <h3 className="text-2xl font-bold text-foreground mb-2">You&apos;re on the highest plan!</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              You&apos;re already subscribed to our Enterprise plan. Contact our sales team for custom enterprise solutions.
            </p>
            <Button onClick={() => router.push('/broker/subscription')}>
              Back to Subscription
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Benefits of Upgrading */}
          <div className="grid gap-6 mb-8 md:grid-cols-3">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Rocket className="h-6 w-6 text-info" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Scale Your Business</h3>
                    <p className="text-sm text-muted-foreground">Higher limits, more growth</p>
                  </div>
                </div>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    More active applications
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Additional team members
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    More branch locations
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center">
                    <Sparkles className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Premium Features</h3>
                    <p className="text-sm text-muted-foreground">Exclusive tools & benefits</p>
                  </div>
                </div>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Featured broker listing
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Priority 24/7 support
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Advanced analytics
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center">
                    <Target className="h-6 w-6 text-success" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Better ROI</h3>
                    <p className="text-sm text-muted-foreground">Higher conversion rates</p>
                  </div>
                </div>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    3x more lead visibility
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Higher client conversion
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    More revenue per client
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Available Upgrade Plans */}
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-foreground">Available Upgrade Plans</h2>
              <Button
                variant="outline"
                onClick={() => setComparisonMode(!comparisonMode)}
                className="gap-2"
              >
                {comparisonMode ? 'Hide Comparison' : 'Show Comparison'}
                <TrendingUp className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {availablePlans.map((plan, index) => {
                const isPopular = plan.name === 'FEATURED'
                const isRecommended = plan.name === 'FEATURED'
                const savings = isAnnual ? Math.round(plan.price * 12 - (plan.price * 11)) : 0

                return (
                  <Card
                    key={plan.name}
                    className={`h-full relative transition-all hover:shadow-lg cursor-pointer ${
                      selectedPlan === plan.name ? 'border-2 border-primary ring-2 ring-primary/20' : ''
                    } ${isPopular ? 'border-2 border-yellow-500' : ''}`}
                    onClick={() => setSelectedPlan(plan.name)}
                  >
                    {isPopular && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <Badge variant="secondary" className="bg-gradient-to-r from-yellow-500 to-orange-500 px-3 py-1">
                          <Star className="h-3 w-3 mr-1" />
                          Most Popular
                        </Badge>
                      </div>
                    )}

                    {isRecommended && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <Badge variant="outline" className="px-3 py-1">
                          <Zap className="h-3 w-3 mr-1" />
                          Recommended
                        </Badge>
                      </div>
                    )}

                    <CardHeader>
                      <div className="flex items-center justify-between mb-2">
                        <CardTitle className="text-xl">{plan.name}</CardTitle>
                        {isAnnual && savings > 0 && (
                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                            Save ${savings}
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="min-h-[40px]">
                        {plan.description}
                      </CardDescription>
                      <div className="mt-4">
                        <div className="text-4xl font-bold">
                          ${getMonthlyPrice(plan.price)}
                          <span className="text-lg text-muted-foreground">{getPricePeriod()}</span>
                        </div>
                        {isAnnual && (
                          <div className="text-sm text-muted-foreground mt-1">
                            ${plan.price}/month billed annually
                          </div>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent>
                      <Separator className="mb-4" />
                      <div className="space-y-3">
                        <h4 className="font-medium text-sm text-muted-foreground">Key Features:</h4>
                        <ul className="space-y-2">
                          {plan.features.slice(0, 5).map((feature, idx) => (
                            <li key={idx} className="flex items-center gap-2 text-sm">
                              <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>

                        <div className="pt-4">
                          <div className="text-sm font-medium text-foreground mb-2">
                            Key Improvements from {currentPlanConfig.name}:
                          </div>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Active Applications:</span>
                              <span className="font-medium">
                                <span className="inline-flex items-center gap-1.5">{currentPlanConfig.limits.maxActiveListings}<ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />{plan.limits.maxActiveListings}</span>
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Team Members:</span>
                              <span className="font-medium">
                                <span className="inline-flex items-center gap-1.5">{currentPlanConfig.limits.maxTeamMembers}<ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />{plan.limits.maxTeamMembers}</span>
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Branches:</span>
                              <span className="font-medium">
                                <span className="inline-flex items-center gap-1.5">{currentPlanConfig.limits.maxBranches}<ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />{plan.limits.maxBranches}</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>

                    <CardFooter>
                      <Button
                        onClick={() => handleUpgrade(plan.name.toUpperCase())}
                        className={`w-full gap-2 ${
                          isPopular ? 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600' : ''
                        }`}
                      >
                        <ArrowUp className="h-4 w-4" />
                        Upgrade to {plan.name}
                      </Button>
                    </CardFooter>
                  </Card>
                )
              })}
            </div>
          </div>

          {/* Feature Comparison Table */}
          {comparisonMode && (
            <Card className="mt-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Detailed Feature Comparison
                </CardTitle>
                <CardDescription>
                  Compare all features between your current plan and upgrade options
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Feature</th>
                        <th className="text-center py-3 px-4 font-medium">
                          <Badge variant="outline" className="text-sm">
                            Current: {currentPlanConfig.name}
                          </Badge>
                        </th>
                        {availablePlans.map(plan => (
                          <th key={plan.name} className="text-center py-3 px-4 font-medium">
                            {plan.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: 'Active Applications', key: 'maxActiveListings' },
                        { label: 'Team Members', key: 'maxTeamMembers' },
                        { label: 'Branches', key: 'maxBranches' },
                        { label: 'Loan Products', key: 'maxLoanProducts' },
                        { label: 'Saved Brokers', key: 'maxSavedBrokers' },
                        { label: 'Featured Placement', key: 'featuredListing' },
                        { label: 'Priority Support', key: 'prioritySupport' },
                        { label: 'Analytics Dashboard', key: 'analyticsDashboard' },
                        { label: 'Custom Reports', key: 'customReports' },
                        { label: 'API Access', key: 'apiAccess' },
                      ].map((feature, index) => (
                        <tr key={index} className="border-t">
                          <td className="py-3 px-4 font-medium">
                            {feature.label}
                          </td>
                          <td className="text-center py-3 px-4">
                            <div className="flex items-center justify-center">
                              {typeof currentPlanConfig.limits[feature.key as keyof typeof currentPlanConfig.limits] === 'boolean' ? (
                                currentPlanConfig.limits[feature.key as keyof typeof currentPlanConfig.limits] ? (
                                  <Check className="h-5 w-5 text-green-500" />
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )
                              ) : (
                                <span className="font-semibold">
                                  {currentPlanConfig.limits[feature.key as keyof typeof currentPlanConfig.limits] as number}
                                </span>
                              )}
                            </div>
                          </td>
                          {availablePlans.map(plan => {
                            const value = plan.limits[feature.key as keyof typeof plan.limits]
                            const currentValue = currentPlanConfig.limits[feature.key as keyof typeof currentPlanConfig.limits]

                            return (
                              <td key={`${plan.name}-${index}`} className="text-center py-3 px-4">
                                <div className="flex flex-col items-center">
                                  {typeof value === 'boolean' ? (
                                    value ? (
                                      <Check className="h-5 w-5 text-green-500" />
                                    ) : (
                                      <span className="text-muted-foreground">-</span>
                                    )
                                  ) : (
                                    <>
                                      <span className="font-semibold">{value}</span>
                                      {typeof value === 'number' && value > (currentValue as number) && (
                                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                          +{value - (currentValue as number)}
                                        </Badge>
                                      )}
                                    </>
                                  )}
                                </div>
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
          )}

          {/* FAQ Section */}
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Upgrade FAQs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h4 className="font-medium mb-2">Will I be charged immediately when I upgrade?</h4>
                  <p className="text-sm text-muted-foreground">
                    Yes, you&apos;ll be charged the prorated amount for the remainder of your current billing cycle,
                    plus the new plan&apos;s price for the next full cycle. The proration ensures you only pay for what you use.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium mb-2">What happens to my existing limits when I upgrade?</h4>
                  <p className="text-sm text-muted-foreground">
                    Your limits increase immediately after upgrade. You&apos;ll have access to all new features
                    and higher limits right away.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Can I downgrade later if needed?</h4>
                  <p className="text-sm text-muted-foreground">
                    Yes, you can downgrade at any time. The downgrade will take effect at the end of your
                    current billing cycle, and you won&apos;t be charged for the lower plan until then.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium mb-2">What if I exceed my new limits before upgrade?</h4>
                  <p className="text-sm text-muted-foreground">
                    Your account will be grandfathered in, meaning you won&apos;t lose access to anything you&apos;re
                    already using. However, you won&apos;t be able to create new items that exceed the old limits
                    until the upgrade is complete.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Contact Sales */}
      {currentPlan === 'FEATURED' && availablePlans.length === 0 && (
        <Card className="mt-8 bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-foreground mb-2">Need Custom Enterprise Solutions?</h3>
                <p className="text-foreground">
                  Contact our sales team for custom pricing, additional features,
                  and enterprise-grade solutions tailored to your business.
                </p>
              </div>
              <Button size="lg" className="mt-4 md:mt-0 gap-2">
                Contact Sales
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
