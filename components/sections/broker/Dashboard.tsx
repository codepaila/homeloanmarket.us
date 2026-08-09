// app/dashboard/page.tsx
'use client'

// import { useSidebarData } from '@/hooks/useSidebarData'
import { useUserPermissions } from '@/hooks/useCurrentUser'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

import { 
  Users, 
  FileText, 
  TrendingUp, 
  DollarSign,
  CheckCircle,
  Clock,
  AlertCircle
} from 'lucide-react'
import { useSidebarData } from '@/hooks/useSidebarData'

export default function DashboardPage() {
  const { user } = useSidebarData()
  const permissions = useUserPermissions()

  const stats = [
    {
      title: "Total Applications",
      value: "24",
      change: "+12%",
      icon: FileText,
      color: "blue"
    },
    {
      title: "Active Mortgage Brokers",
      value: "156",
      change: "+5%",
      icon: Users,
      color: "green"
    },
    {
      title: "Approval Rate",
      value: "78%",
      change: "+3%",
      icon: TrendingUp,
      color: "purple"
    },
    {
      title: "Avg. Loan Amount",
      value: "$450K",
      change: "+8%",
      icon: DollarSign,
      color: "yellow"
    }
  ]

  const quickActions = [
    {
      title: "Start New Application",
      description: "Begin your loan application process",
      href: user.role === 'BROKER' ? '/broker/applications/create' : '/borrower/applications/create',
      icon: FileText,
      color: "primary"
    },
    {
      title: "Find Mortgage Brokers",
      description: "Find verified mortgage brokers",
      href: '/brokers',
      icon: Users,
      color: "success"
    },
    {
      title: "Calculator",
      description: "Calculate monthly payment and eligibility",
      href: '/calculator',
      icon: TrendingUp,
      color: "info"
    }
  ]

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-primary to-primary/80 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              Welcome back, {user.name?.split(' ')[0] || 'there'}!
            </h1>
            <p className="mt-2 opacity-90">
              {user.role === 'BROKER' && 'Manage your loan applications and connect with borrowers'}
              {user.role === 'BORROWER' && 'Track your applications and find the best loan deals'}
              {user.role === 'ADMIN' && 'Monitor platform performance and manage users'}
              {user.role === 'SUPER_ADMIN' && 'Manage system settings and overall platform'}
            </p>
          </div>
           {user.isPremiumBroker && (
            <div className="hidden md:block">
              <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-r from-yellow-400 to-orange-400 flex items-center justify-center">
                    <span className="text-white font-bold">P</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Premium Plan</p>
                    <p className="text-xs opacity-80">Active until Dec 31, 2024</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon
          return (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <Icon className={`h-4 w-4 text-${stat.color}-600`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">
                  <span className="text-success">{stat.change}</span> from last month
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common tasks and quick access features
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {quickActions.map((action, index) => {
              const Icon = action.icon
              return (
                <a
                  key={index}
                  href={action.href}
                  className="group block"
                >
                  <div className={`
                    border rounded-lg p-4 transition-all duration-200
                    hover:border-${action.color}-500 hover:shadow-md
                    group-hover:scale-[1.02]
                  `}>
                    <div className="flex items-center gap-3">
                      <div className={`
                        h-10 w-10 rounded-lg bg-${action.color}-100
                        flex items-center justify-center
                      `}>
                        <Icon className={`h-5 w-5 text-${action.color}-600`} />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{action.title}</p>
                        <p className="text-sm text-muted-foreground">{action.description}</p>
                      </div>
                    </div>
                  </div>
                </a>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Role-specific content */}
      {user.role === 'BROKER' && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-info" />
                Pending Applications
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Pending applications list */}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-600" />
                Recent Leads
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Recent leads list */}
            </CardContent>
          </Card>
        </div>
      )}

      {user.role === 'BORROWER' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-success" />
              Application Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Application status tracker */}
          </CardContent>
        </Card>
      )}

      {(user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') && (
        <Card>
          <CardHeader>
            <CardTitle>Platform Overview</CardTitle>
            <CardDescription>
              System statistics and platform metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Admin dashboard metrics */}
          </CardContent>
        </Card>
      )}
    </div>
  )
}