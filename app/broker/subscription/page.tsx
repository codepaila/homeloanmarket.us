/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  CreditCard,
  BarChart3,
  CheckCircle,
  Clock,
  AlertCircle,
  Download,
  Zap,
  Settings,
  RefreshCw,
  ArrowRight,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useSubscriptionPlans } from '@/hooks/useClient'
import { useBrokerChromeResync } from '@/hooks/useSubscription'
import { useSWRConfig } from 'swr'
import { baseUrl } from '@/utils/baseUrl'
import { brokerPlanDisplayName } from '@/lib/broker-plan-display'
import SubscriptionPlans from '@/components/sections/subscriptions/SubscriptionPlan'
import BillingHistory from '@/components/sections/subscriptions/BillingHistory'
import { Skeleton } from '@/components/ui/skeleton'

export default function SubscriptionPage() {
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [subscriptionData, setSubscriptionData] = useState<any>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const { plans: availablePlans, error: plansError, isLoading: plansLoading, mutate: refetchPlans } =
    useSubscriptionPlans()

  // Live badge sync after an authoritative plan change (e.g. Stripe billing
  // portal return): the broker layout is re-rendered (router.refresh) and the
  // client-side broker/subscription SWR keys are revalidated.
  const resync = useBrokerChromeResync()
  const { cache } = useSWRConfig()
  const fetchedOnceRef = useRef(false)

  const detailsKey = `${baseUrl}/api/subscription/details`

  async function fetchSubscriptionData() {
    try {
      const subscriptionRes = await fetch(detailsKey)
      const subscriptionJson = await subscriptionRes.json()

      if (subscriptionJson.success) {
        // Compare against the previously confirmed plan (from the SWR cache) so
        // a plan change made in the Stripe billing portal is reported on return.
        const previousPlan = cache.get(detailsKey)?.data?.data?.plan as string | undefined
        const nextPlan = subscriptionJson.data?.plan as string | undefined
        const planChanged = Boolean(previousPlan && nextPlan && previousPlan !== nextPlan)
        if (planChanged) {
          toast.success(
            nextPlan === 'FEATURED'
              ? `You're now on the ${brokerPlanDisplayName(nextPlan)} plan.`
              : 'Your subscription has been changed to Free.',
          )
        }
        setSubscriptionData(subscriptionJson.data)
        // Only re-sync the broker chrome (router.refresh + SWR revalidation)
        // when the plan actually changed, e.g. on return from the Stripe billing
        // portal. On an ordinary page load the broker layout is already
        // server-rendered from the authoritative subscription, so a redundant
        // resync would re-issue the same requests plus a full RSC re-render for
        // no state change.
        if (planChanged) resync()
      }
    } catch (error) {
      toast.error('Failed to load subscription data')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!fetchedOnceRef.current) {
      fetchedOnceRef.current = true
      fetchSubscriptionData()
    }
  }, [])

  const handlePortal = async () => {
    setPortalLoading(true)
    try {
      const response = await fetch('/api/subscription/portal', {
        method: 'POST',
      })
      const data = await response.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      toast.error('Failed to access billing portal')
      console.error(error)
    } finally {
      setPortalLoading(false)
    }
  }

  const handleCheckout = async (priceId: string, planName: string) => {
    try {
      const response = await fetch('/api/subscription/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ priceId, plan: planName }),
      })

      const data = await response.json()

      if (data.success && data.url) {
        window.location.href = data.url
      } else {
        throw new Error(data.error || 'Failed to create checkout session')
      }
    } catch (error: any) {
      toast.error(error.message)
      console.error(error)
    }
  }

  const currentPlan = subscriptionData?.plan || 'FREE'
  // The current plan's display info is derived from the database-backed plan
  // set (loaded via /api/subscription/plans), never from a static catalog.
  const currentPlanInfo = Array.isArray(availablePlans)
    ? availablePlans.find((p: any) => p.code === currentPlan)
    : undefined
  const planConfig = currentPlanInfo
    ? {
        name: currentPlanInfo.name,
        price: (currentPlanInfo.price ?? 0) / 100,
        billingInterval: currentPlanInfo.billingInterval || 'month',
        description: currentPlanInfo.description,
        features: currentPlanInfo.features || [],
      }
    : { name: currentPlan, price: 0, billingInterval: 'month', description: null, features: [] as string[] }
  const subscriptionStatus = (subscriptionData?.status || 'INACTIVE') as keyof typeof statusConfig

  const statusConfig = {
    ACTIVE: { label: 'Active', color: 'success', icon: CheckCircle },
    TRIAL: { label: 'Trial', color: 'warning', icon: Clock },
    PAST_DUE: { label: 'Past Due', color: 'destructive', icon: AlertCircle },
    CANCELED: { label: 'Canceled', color: 'destructive', icon: AlertCircle },
    UNPAID: { label: 'Unpaid', color: 'destructive', icon: AlertCircle },
    EXPIRED: { label: 'Expired', color: 'secondary', icon: AlertCircle },
    INACTIVE: { label: 'Inactive', color: 'secondary', icon: AlertCircle },
  }

  const status = statusConfig[subscriptionStatus] || statusConfig.INACTIVE

  return (
    <div className="">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-3xl font-bold text-foreground mb-2">Subscription Management</h1>
        <p className="text-muted-foreground">
          Manage your subscription plan and upgrade features
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-3">
          <TabsTrigger value="overview">
            <BarChart3 className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="plans">
            <CreditCard className="h-4 w-4 mr-2" />
            Plans & Pricing
          </TabsTrigger>
          <TabsTrigger value="billing">
            <Download className="h-4 w-4 mr-2" />
            Billing
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Current Plan Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-6 w-6" />
                  Current Subscription
                </div>
                <Badge variant={status.color as any} className="gap-1">
                  <status.icon className="h-3 w-3" />
                  {status.label}
                </Badge>
              </CardTitle>
              <CardDescription>
                Manage your subscription and billing information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Plan Info */}
              {loading ? (
                <SubscriptionOverviewSkeleton />

              ) : (
              <div className="grid gap-6 md:grid-cols-3">
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">Current Plan</div>
                  <div className="text-2xl font-bold">{planConfig.name}</div>
                  <div className="text-3xl font-bold text-primary">
                    ${planConfig.price}<span className="text-lg text-muted-foreground">/month</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">Billing Cycle</div>
                  <div className="text-xl font-semibold">Monthly</div>
                  {subscriptionData?.nextBillingDate && (
                    <>
                      <div className="text-sm text-muted-foreground">Next Billing Date</div>
                      <div className="font-medium">
                        {new Date(subscriptionData.nextBillingDate).toLocaleDateString()}
                      </div>
                    </>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">Account Status</div>
                  <div className="text-xl font-semibold capitalize">
                    {subscriptionStatus.toLowerCase().replace('_', ' ')}
                  </div>
                  {subscriptionData?.trialEndDate && subscriptionStatus === 'TRIAL' && (
                    <>
                      <div className="text-sm text-muted-foreground">Trial Ends</div>
                      <div className="font-medium">
                        {new Date(subscriptionData.trialEndDate).toLocaleDateString()}
                      </div>
                    </>
                  )}
                </div>
              </div>
              )}

              <Separator />

              {/* Plan Features */}
              <div>
                <h4 className="font-medium mb-4">Included Features</h4>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {planConfig.features.length > 0 ? planConfig.features.map((feature: string, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 p-3 border rounded">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <div>
                        <div className="font-medium">{feature}</div>
                        <div className="text-sm text-muted-foreground">Included in your plan</div>
                      </div>
                    </div>
                  )) : (
                    <div className="flex items-center gap-2 p-3 border rounded">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <div>
                        <div className="font-medium">Standard listing</div>
                        <div className="text-sm text-muted-foreground">Included in all plans</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-3 pt-4">
                <Button
                  onClick={handlePortal}
                  disabled={portalLoading || !subscriptionData?.stripeCustomerId}
                  className="gap-2"
                >
                  {portalLoading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Settings className="h-4 w-4" />
                  )}
                  Manage Billing
                </Button>

                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => setActiveTab('plans')}
                >
                  <ArrowRight className="h-4 w-4" />
                  View Plans
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Premium Features */}
          {currentPlan !== 'FREE' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-500" />
                  {currentPlan} Plan Features
                </CardTitle>
                <CardDescription>
                  Exclusive features available with your {currentPlan} plan
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  {planConfig.features.map((feature: string, idx: number) => (
                    <div key={idx} className="p-4 border rounded">
                      <div className="flex items-center gap-3 mb-3">
                        <Zap className="h-8 w-8 text-yellow-500" />
                        <div>
                          <h4 className="font-semibold">{feature}</h4>
                          <p className="text-sm text-muted-foreground">Included with your plan</p>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        This feature is available with your current {currentPlan} plan.
                      </p>
                    </div>
                  ))}
                  {planConfig.features.length === 0 && (
                    <div className="p-4 border rounded">
                      <div className="flex items-center gap-3 mb-3">
                        <CheckCircle className="h-8 w-8 text-green-500" />
                        <div>
                          <h4 className="font-semibold">Standard Listing</h4>
                          <p className="text-sm text-muted-foreground">Included in all plans</p>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Your mortgage originator profile is listed on the platform.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Plans Tab */}
        <TabsContent value="plans">
          <SubscriptionPlans
            currentPlan={currentPlan}
            onSelectPlan={handleCheckout}
            subscriptionStatus={subscriptionStatus}
            plans={Array.isArray(availablePlans) ? availablePlans : []}
            isLoading={plansLoading}
            error={plansError}
            onRetry={() => refetchPlans()}
          />
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing">
          <BillingHistory />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function SubscriptionOverviewSkeleton() {
  return (
   <div className="grid gap-6 md:grid-cols-3">
    {/* Current Plan */}
    <div className="space-y-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-36" />
      <Skeleton className="h-9 w-28" />
    </div>

    {/* Billing Cycle */}
    <div className="space-y-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-7 w-28" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-5 w-28" />
    </div>

    {/* Account Status */}
    <div className="space-y-2">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-7 w-24" />
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-5 w-28" />
    </div>
  </div>
  )
}