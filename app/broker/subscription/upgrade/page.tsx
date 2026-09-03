// app/broker/subscription/upgrade/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  ArrowUp,
  Check,
  Star,
  Award,
  Rocket,
  Sparkles,
  Target,
  ChevronRight,
} from 'lucide-react'
import { toast } from 'react-hot-toast'

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

export default function UpgradePlanPage() {
  const { status: sessionStatus } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [currentPlan, setCurrentPlan] = useState<string>('FREE')
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [plans, setPlans] = useState<PublicPlan[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const [detailsRes, plansRes] = await Promise.all([
          fetch('/api/subscription/details'),
          fetch('/api/subscription/plans'),
        ])
        const details = await detailsRes.json()
        const plansData = await plansRes.json()
        if (active) {
          if (details.success) setCurrentPlan(details.data?.plan || 'FREE')
          setPlans(Array.isArray(plansData.plans) ? plansData.plans : [])
        }
      } catch {
        if (active) setError('Failed to load plan options')
      } finally {
        if (active) setLoading(false)
      }
    }
    if (sessionStatus === 'unauthenticated') router.push('/login')
    else if (sessionStatus === 'authenticated') void load()
    return () => { active = false }
  }, [sessionStatus, router])

  // Upgrade eligibility is determined by the database displayOrder.
  const orderOf = (code: string) => plans.find((p) => p.code === code)?.displayOrder ?? Number.MAX_SAFE_INTEGER
  const currentOrder = orderOf(currentPlan)
  const availablePlans = plans
    .filter((plan) => plan.displayOrder > currentOrder)
    .sort((a, b) => a.displayOrder - b.displayOrder)

  const handleUpgrade = async (planCode: string) => {
    const plan = plans.find((p) => p.code === planCode)
    if (!plan || !plan.stripePriceId) return

    try {
      const response = await fetch('/api/subscription/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: plan.stripePriceId,
          plan: plan.code,
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

  if (error) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4">
        <Card className="text-center py-12">
          <CardContent>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const currentPlanInfo = plans.find((p) => p.code === currentPlan)

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
            Current: {currentPlanInfo?.name || currentPlan}
          </Badge>
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
              There are no higher plans available to upgrade to at this time.
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
                    <p className="text-sm text-muted-foreground">More growth and visibility</p>
                  </div>
                </div>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Mortgage Expert placement
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Premium entitlements
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Priority support
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
                    Profile badge
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Support tickets
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Advanced tools
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
            <h2 className="text-2xl font-bold text-foreground">Available Upgrade Plans</h2>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {availablePlans.map((plan) => {
                const isPopular = plan.code === 'FEATURED'
                const pricePerMonth = plan.price / 100

                return (
                  <Card
                    key={plan.id}
                    className={`h-full relative transition-all hover:shadow-lg cursor-pointer ${
                      selectedPlan === plan.code ? 'border-2 border-primary ring-2 ring-primary/20' : ''
                    } ${isPopular ? 'border-2 border-yellow-500' : ''}`}
                    onClick={() => setSelectedPlan(plan.code)}
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
                      <div className="flex items-center justify-between mb-2">
                        <CardTitle className="text-xl">{plan.name}</CardTitle>
                      </div>
                      <CardDescription className="min-h-[40px]">
                        {plan.description}
                      </CardDescription>
                      <div className="mt-4">
                        <div className="text-4xl font-bold">
                          ${pricePerMonth.toFixed(2)}
                          <span className="text-lg text-muted-foreground">/{plan.billingInterval}</span>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent>
                      <Separator className="mb-4" />
                      <div className="space-y-3">
                        <h4 className="font-medium text-sm text-muted-foreground">Included Features:</h4>
                        <ul className="space-y-2">
                          {plan.features.length > 0 ? plan.features.map((feature, idx) => (
                            <li key={idx} className="flex items-center gap-2 text-sm">
                              <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                              <span>{feature}</span>
                            </li>
                          )) : (
                            <li className="text-sm text-muted-foreground">No additional features</li>
                          )}
                        </ul>
                      </div>
                    </CardContent>

                    <CardFooter>
                      <Button
                        onClick={() => handleUpgrade(plan.code)}
                        disabled={!plan.stripePriceId}
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
                    You&apos;ll be charged the prorated amount for the remainder of your current billing cycle,
                    plus the new plan&apos;s price for the next full cycle.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">What happens to my entitlements when I upgrade?</h4>
                  <p className="text-sm text-muted-foreground">
                    Your plan entitlements (such as your profile badge and support) update after upgrade.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Can I downgrade later if needed?</h4>
                  <p className="text-sm text-muted-foreground">
                    Yes, you can downgrade at any time. The downgrade will take effect at the end of your
                    current billing cycle.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Contact Sales */}
      {availablePlans.length === 0 && (
        <Card className="mt-8 bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-foreground mb-2">Need a custom plan?</h3>
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