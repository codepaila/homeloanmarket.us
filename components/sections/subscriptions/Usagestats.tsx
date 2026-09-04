'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Banknote, 
  Eye, 
  Star, 
  FileText,
  BarChart3,
  Target,
  Zap,
  CheckCircle
} from 'lucide-react'

interface UsageStatsProps {
  usageData: {
    usage?: Record<string, number | undefined>
    limits?: Record<string, number | undefined>
    subscription?: { isActive?: boolean; plan?: string }
  }
  plan: {
    features?: string[]
    name?: string
  }
}

export default function UsageStats({ usageData, plan }: UsageStatsProps) {
  if (!usageData) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="text-muted-foreground">No usage data available</div>
        </CardContent>
      </Card>
    )
  }

  const { usage, subscription } = usageData
  const planFeatures = plan?.features || []

  const usageItems = [
    {
      label: 'Bank Partners',
      current: usage?.bankPartners || 0,
      icon: Banknote,
      color: 'blue',
      description: 'Number of bank partnerships'
    },
    {
      label: 'Profile Views',
      current: usage?.profileViews || 0,
      icon: Eye,
      color: 'purple',
      description: 'Total profile views'
    },
    {
      label: 'Contact Messages',
      current: usage?.contactMessages || 0,
      icon: FileText,
      color: 'orange',
      description: 'Messages received'
    },
    {
      label: 'Reviews',
      current: usage?.reviews || 0,
      icon: Star,
      color: 'yellow',
      description: 'Total customer reviews'
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
                <p className="text-sm text-muted-foreground">Bank Partners</p>
                <p className="text-2xl font-bold mt-1">
                  {usage?.bankPartners || 0}
                </p>
              </div>
              <div className="h-12 w-12 rounded bg-blue-100 flex items-center justify-center">
                <Banknote className="h-6 w-6 text-info" />
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
              <div className="h-12 w-12 rounded bg-purple-100 flex items-center justify-center">
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
              <div className="h-12 w-12 rounded bg-yellow-100 flex items-center justify-center">
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
            Track your resource usage
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {usageItems.map((item, index) => (
              <div key={index}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded ${
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
                  </div>
                </div>
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
            {planFeatures.length > 0 ? planFeatures.map((feature, index) => (
              <div key={index} className="p-4 border rounded">
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle className="h-5 w-5 text-success" />
                  <div>
                    <h4 className="font-medium">{feature}</h4>
                    <p className="text-sm text-muted-foreground">Status</p>
                  </div>
                </div>
                <div className="text-sm font-medium text-success">Enabled</div>
              </div>
            )) : (
              <div className="p-4 border rounded">
                <div className="flex items-center gap-3 mb-2">
                  <Zap className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <h4 className="font-medium">Standard Listing</h4>
                    <p className="text-sm text-muted-foreground">Included in all plans</p>
                  </div>
                </div>
                <div className="text-sm font-medium text-muted-foreground">Active</div>
              </div>
            )}
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
            <div className="p-4 bg-purple-50 rounded">
              <h4 className="font-medium text-purple-900 mb-2">Profile Visibility</h4>
              <p className="text-sm text-purple-700">
                Your profile has been viewed {usage?.profileViews || 0} times.
                {subscription?.isActive && subscription?.plan !== 'FREE'
                  ? ' Your Mortgage Expert placement helps increase visibility.'
                  : ' Consider upgrading to Mortgage Expert and increase visibility.'
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
