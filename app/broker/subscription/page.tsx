/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  CreditCard, 
  BarChart3, 
  Users, 
  Building, 
  FileText, 
  Star,
  CheckCircle,
  Clock,
  AlertCircle,
  Download,
  TrendingUp,
  Zap,
  Award,
  Globe,
  MessageSquare,
  Settings,
  RefreshCw,
  ArrowRight,
  Banknote,
  Phone,
  Mail,
  Eye,
  FileCheck,
  Headphones,
  LineChart
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { subscriptionPlans } from '@/lib/stripe'
import  SubscriptionPlans  from '@/components/sections/subscriptions/SubscriptionPlan'
import  UsageStats  from '@/components/sections/subscriptions/Usagestats'
import  BillingHistory  from '@/components/sections/subscriptions/BillingHistory'

// Import components - create these if they don't exist
// import SubscriptionPlans from '@/components/subscription/SubscriptionPlans'
// import UsageStats from '@/components/subscription/UsageStats'
// import BillingHistory from '@/components/subscription/BillingHistory'

export default function SubscriptionPage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [usageData, setUsageData] = useState<any>(null)
  const [subscriptionData, setSubscriptionData] = useState<any>(null)
  const [portalLoading, setPortalLoading] = useState(false)

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading subscription information...</p>
        </div>
      </div>
    )
  }

  const currentPlan = subscriptionData?.plan || 'FREE'
  const planConfig = subscriptionPlans.find(p => p.name === currentPlan) || subscriptionPlans[0]
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
    <div className="max-w-7xl mx-auto py-8 px-4">
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
                <h4 className="font-medium mb-4">Plan Features</h4>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {/* <div className="flex items-center gap-2 p-3 border rounded-lg">
                    <Banknote className="h-5 w-5 text-blue-500" />
                    <div>
                      <div className="font-medium">{planConfig.limits.maxBankPartners} Bank Partners</div>
                      <div className="text-sm text-muted-foreground">Maximum bank partnerships</div>
                    </div>
                  </div> */}
                  
                  <div className="flex items-center gap-2 p-3 border rounded-lg">
                    <Phone className="h-5 w-5 text-green-500" />
                    <div>
                      <div className="font-medium">
                        {planConfig.limits.canShowContact ? 'Direct Contact' : 'Platform Contact'}
                      </div>
                      <div className="text-sm text-muted-foreground">Contact information</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 p-3 border rounded-lg">
                    <Star className="h-5 w-5 text-yellow-500" />
                    <div>
                      <div className="font-medium">
                        {planConfig.limits.isFeatured ? 'Featured Placement' : 'Standard Placement'}
                      </div>
                      <div className="text-sm text-muted-foreground">Profile visibility</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-3 border rounded-lg">
                    <Headphones className="h-5 w-5 text-orange-500" />
                    <div>
                      <div className="font-medium">
                        {planConfig.limits.prioritySupport ? 'Priority Support' : 'Email Support'}
                      </div>
                      <div className="text-sm text-muted-foreground">Customer support</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-3 border rounded-lg">
                    <LineChart className="h-5 w-5 text-red-500" />
                    <div>
                      <div className="font-medium">
                        {planConfig.limits.advancedAnalytics ? 'Advanced Analytics' : 'Basic Analytics'}
                      </div>
                      <div className="text-sm text-muted-foreground">Analytics dashboard</div>
                    </div>
                  </div>
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
            <div className="grid gap-6 md:grid-cols-3">
              {/* <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Bank Partners</p>
                      <p className="text-2xl font-bold mt-1">
                        {usageData.usage?.bankPartners || 0}/{planConfig.limits.maxBankPartners}
                      </p>
                    </div>
                    <Banknote className="h-10 w-10 text-blue-100 bg-blue-500/20 p-2 rounded-lg" />
                  </div>
                  <Progress 
                    value={Math.min(
                      ((usageData.usage?.bankPartners || 0) / planConfig.limits.maxBankPartners) * 100,
                      100
                    )} 
                    className="mt-4"
                  />
                </CardContent>
              </Card> */}

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Monthly Leads</p>
                      <p className="text-2xl font-bold mt-1">
                        {usageData.usage?.monthlyLeads || 0}
                      </p>
                    </div>
                    <MessageSquare className="h-10 w-10 text-green-100 bg-green-500/20 p-2 rounded-lg" />
                  </div>
                  <div className="mt-4 text-sm text-muted-foreground">
                    Total leads: {usageData.usage?.totalLeads || 0}
                  </div>
                </CardContent>
              </Card>

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
                  {planConfig.limits.isFeatured && (
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center gap-3 mb-3">
                        <Star className="h-8 w-8 text-yellow-500" />
                        <div>
                          <h4 className="font-semibold">Featured Placement</h4>
                          <p className="text-sm text-muted-foreground">Top placement in search</p>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Get 3x more visibility and appear at the top of broker listings
                      </p>
                    </div>
                  )}

                  {planConfig.limits.canShowContact && (
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center gap-3 mb-3">
                        <Phone className="h-8 w-8 text-green-500" />
                        <div>
                          <h4 className="font-semibold">Direct Contact</h4>
                          <p className="text-sm text-muted-foreground">Show phone & WhatsApp</p>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Clients can contact you directly without going through the platform
                      </p>
                    </div>
                  )}

                  {planConfig.limits.prioritySupport && (
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center gap-3 mb-3">
                        <Headphones className="h-8 w-8 text-blue-500" />
                        <div>
                          <h4 className="font-semibold">Priority Support</h4>
                          <p className="text-sm text-muted-foreground">24/7 dedicated support</p>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Get faster response times and dedicated support for critical issues
                      </p>
                    </div>
                  )}

                  {planConfig.limits.advancedAnalytics && (
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center gap-3 mb-3">
                        <LineChart className="h-8 w-8 text-purple-500" />
                        <div>
                          <h4 className="font-semibold">Advanced Analytics</h4>
                          <p className="text-sm text-muted-foreground">Detailed insights</p>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Access detailed analytics and performance reports for your business
                      </p>
                    </div>
                  )}

                  {planConfig.limits.customProfile && (
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center gap-3 mb-3">
                        <FileCheck className="h-8 w-8 text-red-500" />
                        <div>
                          <h4 className="font-semibold">Custom Profile</h4>
                          <p className="text-sm text-muted-foreground">Enhanced profile page</p>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Customize your broker profile with additional sections and branding
                      </p>
                    </div>
                  )}

                  {planConfig.limits.phoneSupport && (
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center gap-3 mb-3">
                        <Phone className="h-8 w-8 text-orange-500" />
                        <div>
                          <h4 className="font-semibold">Phone Support</h4>
                          <p className="text-sm text-muted-foreground">Direct phone assistance</p>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Get access to phone support for immediate assistance
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
          />
        </TabsContent>

        {/* Usage Tab */}
        <TabsContent value="usage">
          <UsageStats usageData={usageData} planConfig={planConfig} />
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing">
          <BillingHistory />
        </TabsContent>
      </Tabs>
    </div>
  )
}
