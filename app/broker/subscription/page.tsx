/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
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
  TrendingUp,
  Zap,
  MessageSquare,
  Settings,
  RefreshCw,
  ArrowRight,
  Eye
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useSubscriptionPlans } from '@/hooks/useClient'
import  SubscriptionPlans  from '@/components/sections/subscriptions/SubscriptionPlan'
import  UsageStats  from '@/components/sections/subscriptions/Usagestats'
import  BillingHistory  from '@/components/sections/subscriptions/BillingHistory'

// Import components - create these if they don't exist
// import SubscriptionPlans from '@/components/subscription/SubscriptionPlans'
// import UsageStats from '@/components/subscription/UsageStats'
// import BillingHistory from '@/components/subscription/BillingHistory'

export default function SubscriptionPage() {
  const { status: sessionStatus } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [usageData, setUsageData] = useState<any>(null)
  const [subscriptionData, setSubscriptionData] = useState<any>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const { plans: availablePlans, error: plansError, isLoading: plansLoading, mutate: refetchPlans } =
    useSubscriptionPlans()

  async function fetchSubscriptionData() {
    try {
      const [usageRes, subscriptionRes] = await Promise.all([
        fetch('/api/subscription/usage'),
        fetch('/api/subscription/details')
      ])

      const usageJson = await usageRes.json()
      const subscriptionJson = await subscriptionRes.json()

      if (usageJson.success) setUsageData(usageJson.data)
      if (subscriptionJson.success) setSubscriptionData(subscriptionJson.data)
    } catch (error) {
      toast.error('Failed to load subscription data')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/auth/signin')
    } else if (sessionStatus === 'authenticated') {
      fetchSubscriptionData()
    }
  }, [sessionStatus, router])

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

  if (loading || sessionStatus === 'loading') {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading subscription information...</p>
        </div>
      </div>
    )
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
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Subscription Management</h1>
        <p className="text-muted-foreground">
          Manage your subscription plan, view usage, and upgrade features
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-4">
          <TabsTrigger value="overview">
            <BarChart3 className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="plans">
            <CreditCard className="h-4 w-4 mr-2" />
            Plans & Pricing
          </TabsTrigger>
          <TabsTrigger value="usage">
            <TrendingUp className="h-4 w-4 mr-2" />
            Usage
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

              <Separator />

              {/* Plan Features */}
              <div>
                <h4 className="font-medium mb-4">Included Features</h4>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {planConfig.features.length > 0 ? planConfig.features.map((feature: string, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 p-3 border rounded-lg">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <div>
                        <div className="font-medium">{feature}</div>
                        <div className="text-sm text-muted-foreground">Included in your plan</div>
                      </div>
                    </div>
                  )) : (
                    <div className="flex items-center gap-2 p-3 border rounded-lg">
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

                <Button 
                  variant="outline" 
                  className="gap-2"
                  onClick={() => setActiveTab('usage')}
                >
                  <TrendingUp className="h-4 w-4" />
                  View Usage
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          {usageData && (
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Profile Views</p>
                      <p className="text-2xl font-bold mt-1">
                        {usageData.usage?.profileViews || 0}
                      </p>
                    </div>
                    <Eye className="h-10 w-10 text-purple-100 bg-purple-500/20 p-2 rounded-lg" />
                  </div>
                  <div className="mt-4 text-sm text-muted-foreground">
                    +{(usageData.usage?.profileViews || 0) > 100 ? 'High' : 'Growing'} visibility
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

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
                    <div key={idx} className="p-4 border rounded-lg">
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
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center gap-3 mb-3">
                        <CheckCircle className="h-8 w-8 text-green-500" />
                        <div>
                          <h4 className="font-semibold">Standard Listing</h4>
                          <p className="text-sm text-muted-foreground">Included in all plans</p>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Your broker profile is listed on the platform.
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

        {/* Usage Tab */}
        <TabsContent value="usage">
          <UsageStats usageData={usageData} plan={planConfig} />
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing">
          <BillingHistory />
        </TabsContent>
      </Tabs>
    </div>
  )
}
