'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { 
  Banknote, 
  MessageSquare, 
  Eye, 
  Star, 
  Users, 
  TrendingUp, 
  FileText,
  BarChart3,
  Target,
  Calendar,
  Phone,
  Headphones
} from 'lucide-react'

interface UsageStatsProps {
  usageData: {
    usage?: Record<string, number | undefined>
    limits?: {
      maxBankPartners?: number
    }
    subscription?: { isActive?: boolean; plan?: string }
  }
  planConfig: {
    limits?: {
      canShowContact?: boolean
      isFeatured?: boolean
      prioritySupport?: boolean
    }
  }
}

export default function UsageStats({ usageData, planConfig }: UsageStatsProps) {
  if (!usageData) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="text-muted-foreground">No usage data available</div>
        </CardContent>
      </Card>
    )
  }

  const { usage, limits, subscription } = usageData
  const bankPartners = usage?.bankPartners ?? 0
  const maxBankPartners = limits?.maxBankPartners ?? 0
  const monthlyLeads = usage?.monthlyLeads ?? 0

  const usageItems = [
    {
      label: 'Bank Partners',
      current: usage?.bankPartners || 0,
      max: limits?.maxBankPartners || 0,
      icon: Banknote,
      color: 'blue',
      description: 'Number of bank partnerships'
    },
    {
      label: 'Monthly Leads',
      current: usage?.monthlyLeads || 0,
      max: null,
      icon: MessageSquare,
      color: 'green',
      description: 'Leads received this month'
    },
    {
      label: 'Profile Views',
      current: usage?.profileViews || 0,
      max: null,
      icon: Eye,
      color: 'purple',
      description: 'Total profile views'
    },
    {
      label: 'Contact Messages',
      current: usage?.contactMessages || 0,
      max: null,
      icon: FileText,
      color: 'orange',
      description: 'Messages received'
    },
    {
      label: 'Reviews',
      current: usage?.reviews || 0,
      max: null,
      icon: Star,
      color: 'yellow',
      description: 'Total customer reviews'
    },
    {
      label: 'Total Leads',
      current: usage?.totalLeads || 0,
      max: null,
      icon: TrendingUp,
      color: 'red',
      description: 'All-time leads received'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Bank Partners Usage</p>
                <p className="text-2xl font-bold mt-1">
                  {usage?.bankPartners || 0}/{limits?.maxBankPartners || 0}
                </p>
                <Progress 
                  value={Math.min(
                    ((usage?.bankPartners || 0) / (limits?.maxBankPartners || 1)) * 100,
                    100
                  )} 
                  className="mt-3"
                />
              </div>
              <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <Banknote className="h-6 w-6 text-info" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Monthly Leads</p>
                <p className="text-2xl font-bold mt-1">
                  {usage?.monthlyLeads || 0}
                </p>
                <div className="mt-3 text-sm text-muted-foreground">
                  +{Math.round((usage?.monthlyLeads || 0) / 30)} per day
                </div>
              </div>
              <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center">
                <MessageSquare className="h-6 w-6 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Profile Views</p>
                <p className="text-2xl font-bold mt-1">
                  {usage?.profileViews || 0}
                </p>
                <div className="mt-3 text-sm text-muted-foreground">
                  +{Math.round((usage?.profileViews || 0) / 30)} daily views
                </div>
              </div>
              <div className="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center">
                <Eye className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Subscription</p>
                <p className="text-2xl font-bold mt-1">
                  {subscription?.isActive ? 'Active' : 'Inactive'}
                </p>
                <div className="mt-3 text-sm text-muted-foreground">
                  {subscription?.plan || 'FREE'} Plan
                </div>
              </div>
              <div className="h-12 w-12 rounded-lg bg-yellow-100 flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Usage */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Usage Statistics</CardTitle>
          <CardDescription>
            Track your resource usage and limits
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {usageItems.map((item, index) => (
              <div key={index}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg ${
                      item.color === 'blue' ? 'bg-blue-100' :
                      item.color === 'green' ? 'bg-green-100' :
                      item.color === 'purple' ? 'bg-purple-100' :
                      item.color === 'orange' ? 'bg-orange-100' :
                      item.color === 'yellow' ? 'bg-yellow-100' : 'bg-red-100'
                    } flex items-center justify-center`}>
                      <item.icon className={`h-5 w-5 ${
                        item.color === 'blue' ? 'text-info' :
                        item.color === 'green' ? 'text-success' :
                        item.color === 'purple' ? 'text-purple-600' :
                        item.color === 'orange' ? 'text-orange-600' :
                        item.color === 'yellow' ? 'text-warning' : 'text-destructive'
                      }`} />
                    </div>
                    <div>
                      <h4 className="font-medium">{item.label}</h4>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">{item.current}</div>
                    {item.max !== null && (
                      <div className="text-sm text-muted-foreground">of {item.max} limit</div>
                    )}
                  </div>
                </div>
                {item.max !== null && (
                  <Progress 
                    value={Math.min((item.current / item.max) * 100, 100)}
                    className="mt-2"
                  />
                )}
                {index < usageItems.length - 1 && <Separator className="mt-4" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Plan Features Status */}
      <Card>
        <CardHeader>
          <CardTitle>Plan Features Status</CardTitle>
          <CardDescription>
            Current status of your plan features
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <Phone className={`h-5 w-5 ${
                  planConfig?.limits?.canShowContact ? 'text-success' : 'text-muted-foreground'
                }`} />
                <div>
                  <h4 className="font-medium">Direct Contact</h4>
                  <p className="text-sm text-muted-foreground">Status</p>
                </div>
              </div>
              <div className={`text-sm font-medium ${
                planConfig?.limits?.canShowContact ? 'text-success' : 'text-muted-foreground'
              }`}>
                {planConfig?.limits?.canShowContact ? 'Enabled' : 'Disabled'}
              </div>
            </div>

            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <Star className={`h-5 w-5 ${
                  planConfig?.limits?.isFeatured ? 'text-warning' : 'text-muted-foreground'
                }`} />
                <div>
                  <h4 className="font-medium">Featured Placement</h4>
                  <p className="text-sm text-muted-foreground">Status</p>
                </div>
              </div>
              <div className={`text-sm font-medium ${
                planConfig?.limits?.isFeatured ? 'text-warning' : 'text-muted-foreground'
              }`}>
                {planConfig?.limits?.isFeatured ? 'Active' : 'Inactive'}
              </div>
            </div>

            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <Headphones className={`h-5 w-5 ${
                  planConfig?.limits?.prioritySupport ? 'text-info' : 'text-muted-foreground'
                }`} />
                <div>
                  <h4 className="font-medium">Priority Support</h4>
                  <p className="text-sm text-muted-foreground">Status</p>
                </div>
              </div>
              <div className={`text-sm font-medium ${
                planConfig?.limits?.prioritySupport ? 'text-info' : 'text-muted-foreground'
              }`}>
                {planConfig?.limits?.prioritySupport ? 'Available' : 'Standard'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Usage Optimization Tips
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Bank Partners</h4>
              <p className="text-sm text-blue-700">
                {bankPartners >= maxBankPartners
                  ? `You've reached your maximum bank partners limit. Consider upgrading to add more partnerships.`
                  : `You have ${maxBankPartners - bankPartners} bank partner slots available. Add more partnerships to increase your offerings.`
                }
              </p>
            </div>

            <div className="p-4 bg-green-50 rounded-lg">
              <h4 className="font-medium text-green-900 mb-2">Lead Generation</h4>
              <p className="text-sm text-green-700">
                You received {monthlyLeads} leads this month.
                {monthlyLeads > 10
                  ? ' Great job! Keep up the good work.'
                  : ' Consider optimizing your profile and services to attract more clients.'
                }
              </p>
            </div>

            <div className="p-4 bg-purple-50 rounded-lg">
              <h4 className="font-medium text-purple-900 mb-2">Profile Visibility</h4>
              <p className="text-sm text-purple-700">
                Your profile has been viewed {usage?.profileViews || 0} times. 
                {subscription?.isActive && subscription?.plan !== 'FREE'
                  ? ' Featured listings help increase visibility by 3x.'
                  : ' Consider upgrading to get featured and increase visibility.'
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
