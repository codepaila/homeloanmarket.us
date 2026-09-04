// components/broker/BrokerDashboard.tsx - Simplified Version
'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type BadgeVariant = React.ComponentProps<typeof Badge>['variant']
import {
  Users,
  FileText,
  TrendingUp,
  MessageSquare,
  Star,
  CheckCircle,
  Clock,
  AlertCircle,
  Plus,
  ArrowRight,
  Building,
  Shield,
  Eye,
  MapPin,
  Phone,
  Mail,
  Download,
  BarChart3,
  Calendar,
  Globe
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import Link from 'next/link'
import {
  useMyBrokerProfile,
  useMyContactMessages,
  // Remove useBankRelations
} from '@/hooks/useClient'
import { useUserPermissions } from '@/hooks/useCurrentUser'

// Inside the component

import { useCurrentUser } from '@/hooks/useCurrentUser'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

interface DashboardReview {
  id?: string
  rating?: number
  comment?: string | null
  createdAt?: string | Date
  user?: { name?: string | null; image?: string | null } | null
}

interface DashboardBroker {
  id: string
  displayName: string
  companyName?: string | null
  description: string
  profileSlug: string
  phone: string
  email?: string | null
  website?: string | null
  whatsapp?: string | null
  officeAddress: string
  city?: string | null
  state?: string | null
  pinCode?: string | null
  experienceYears: number
  logo?: string | null
  coverImage?: string | null
  avgRating: number
  totalReviews: number
  totalLeads: number
  profileViews: number
  verificationStatus: string
  reviews?: DashboardReview[]
  user?: { name?: string | null; image?: string | null } | null
}

interface DashboardContact {
  id: string
  name: string
  contactType?: string
  message?: string
  isRead?: boolean
  loanAmount?: number
  createdAt?: string | Date
}

interface DashboardAnalytics {
  recentContacts?: number
  requiresSubscription?: boolean
  totalContacts30Days?: number
  avgLoanAmount?: number | null
  analytics?: {
    summary: { totalContacts?: number; respondedContacts?: number; responseRate?: number; period?: string }
    performance: { avgResponseTime?: number; satisfactionScore?: number }
    charts: { dailyContacts: Array<{ date?: string; count: number }> }
    insights: {
      popularLoanTypes: Array<{ type: string; count: number }>
      topCities: Array<{ city: string; count: number }>
    }
  }
}

interface BrokerDashboardProps {
  initialData?: {
    broker?: DashboardBroker
    stats?: DashboardAnalytics
  }
}

export function BrokerDashboard({ initialData }: BrokerDashboardProps) {
  const user = useCurrentUser()
  const [timeRange, setTimeRange] = useState('30days')
  const userPermissions = useUserPermissions()
  const canAccessAnalytics = userPermissions.canAccessAnalytics
  // Fetch data using hooks
  const { data: broker, isLoading: isLoadingBroker } = useMyBrokerProfile()
  const { contacts, stats: contactStats } = useMyContactMessages({
    status: 'unread',
    page: 1,
    pageSize: 5
  })
  const [isVerifing, setISVerifing] = useState<boolean>(false);
  // Remove bank relations

  // Use initial data or fetched data
  const currentBroker = broker || initialData?.broker
  const currentAnalytics = initialData?.stats

  // Calculate profile completion percentage
  const calculateProfileCompletion = () => {
    if (!currentBroker) return 0

    const fields = [
      currentBroker.displayName,
      currentBroker.description,
      currentBroker.phone,
      currentBroker.email,
      currentBroker.officeAddress,
      currentBroker.city,
      currentBroker.state,
      currentBroker.pinCode,
      currentBroker.experienceYears > 0,
      currentBroker.logo,
      currentBroker.coverImage
    ]

    const completed = fields.filter(Boolean).length
    return Math.round((completed / fields.length) * 100)
  }

  // Stats for dashboard
  const stats = [
    {
      title: "Total Messages",
      value: contactStats?.total || 0,
      change: null,
      icon: MessageSquare,
      color: "blue"
    },
    {
      title: "Avg. Rating",
      value: currentBroker?.avgRating?.toFixed(1) || '0.0',
      change: null,
      icon: Star,
      color: "yellow"
    },
    {
      title: "Profile Views",
      value: currentBroker?.profileViews || 0,
      change: null,
      icon: Eye,
      color: "purple"
    },
    {
      title: "Reviews",
      value: currentBroker?.totalReviews || 0,
      change: null,
      icon: FileText,
      color: "green"
    }
  ]

  const quickActions = [
    {
      title: "Update Profile",
      description: "Edit your mortgage broker profile information",
      href: "/broker/profile/edit",
      icon: Building,
      color: "primary"
    },
    {
      title: "View Contact Messages",
      description: "Check messages from potential clients",
      href: "/broker/messages",
      icon: MessageSquare,
      color: "success",
      badge: contactStats?.unread || 0
    },
    {
      title: "View Reviews",
      description: "See what clients are saying about your services",
      href: "/broker/profile",
      icon: Star,
      color: "info"
    }
  ]

  const verificationStatus = {
    UNVERIFIED: {
      label: "Unverified",
      color: "warning",
      icon: Clock,
      description: "Submit documents for verification"
    },
    VERIFIED: {
      label: "Verified",
      color: "success",
      icon: CheckCircle,
      description: "Your profile is verified and trusted"
    }
  }

  const status = verificationStatus[(currentBroker?.verificationStatus || 'UNVERIFIED') as keyof typeof verificationStatus]

  const brokerStatus = {
    FREE: { label: "Free", color: "gray", icon: Building },
    FEATURED: { label: "Mortgage Expert", color: "premium", icon: Star },
    SUSPENDED: { label: "Suspended", color: "destructive", icon: AlertCircle }
  }

  const currentBrokerStatus = brokerStatus[(currentBroker?.brokerStatus || 'FREE') as keyof typeof brokerStatus]

  if (isLoadingBroker) {
    return (
      <div className="space-y-6">
        <div className="h-32 bg-gradient-to-r from-primary/20 to-primary/10 rounded animate-pulse" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="h-4 bg-muted rounded animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (!currentBroker) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Building className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Mortgage Originator Profile Found</h3>
          <p className="text-muted-foreground mb-6">
            You need to create a mortgage originator profile to access the dashboard
          </p>
          <Button asChild>
            <Link href="/setup">
              <Plus className="mr-2 h-4 w-4" />
              Create Mortgage Originator Profile
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }
  // In BrokerDashboard.tsx - fix the handleResendVerification function
  const handleResendVerification = async () => {
    setISVerifing(true)
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: user?.email }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Verification email sent! Please check your inbox.')
      } else {
        toast.error(data.error || 'Failed to send verification email')
      }
      setISVerifing(false)
    } catch (error) {
      console.error('Failed to resend verification:', error)
      toast.error('Failed to send verification email')
    } finally {
      setISVerifing(false)
    }
  }
  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-primary to-primary/80 rounded p-6 text-white">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-start gap-4">
              {currentBroker?.logo ? (
                <img
                  src={currentBroker.logo}
                  alt={currentBroker.displayName}
                  className="h-20 w-20 rounded border-4 border-white/20 object-cover"
                />
              ) : (
                <div className="h-20 w-20 rounded bg-white/20 flex items-center justify-center border-4 border-white/20">
                  <Building className="h-10 w-10" />
                </div>
              )}
              <div className="flex-1">
                <h1 className="text-2xl font-bold">{currentBroker.displayName}</h1>
                {currentBroker.companyName && (
                  <p className="text-white/80">{currentBroker.companyName}</p>
                )}
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <Badge variant="secondary" className="bg-white/20 hover:bg-white/30">
                    <status.icon className="h-3 w-3 mr-1" />
                    {status.label}
                  </Badge>
                  <Badge variant="secondary" className="bg-white/20 hover:bg-white/30">
                    <Star className="h-3 w-3 mr-1" />
                    {currentBroker.avgRating?.toFixed(1) || '0.0'} ({currentBroker.totalReviews || 0} reviews)
                  </Badge>
                  <Badge variant="secondary" className="bg-white/20 hover:bg-white/30">
                    <MapPin className="h-3 w-3 mr-1" />
                    {currentBroker.city}
                  </Badge>
                  <Badge variant="secondary" className="bg-white/20 hover:bg-white/30">
                    <Calendar className="h-3 w-3 mr-1" />
                    {currentBroker.experienceYears || 0}+ years
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {user?.emailVerified === false && (
              <button onClick={handleResendVerification} className="gap-2 btn  bg-accent-foreground">

                <AlertCircle className="h-4 w-4" />
                {isVerifing ? "Sending Verification..." : "Verify Your Email"}

              </button>
            )}
            {user?.brokerProfile?.verificationStatus === 'UNVERIFIED' && (
              <Button variant="secondary" className="gap-2" asChild>
                <Link href="/broker/profile">
                  <AlertCircle className="h-4 w-4" />
                   Get Verified
                </Link>
              </Button>
            )}
            {/* <Button variant="outline" className="bg-white/10 hover:bg-white/20 text-white" asChild>
              <Link href={`/brokers/${currentBroker.profileSlug}`}>
                <Eye className="mr-2 h-4 w-4" />
                View Public Profile
              </Link>
            </Button> */}
          </div>
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
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.change ? <><span className="text-success">{stat.change}</span> from last month</> : 'Current total'}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid grid-cols-2 md:grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contacts">
            Messages
            {contactStats?.unread > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 text-xs">
                {contactStats.unread}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
          {canAccessAnalytics && (
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {quickActions.map((action, index) => {
              const Icon = action.icon
              return (
                <Link key={index} href={action.href}>
                  <Card className="hover:border-primary transition-colors cursor-pointer hover:shadow-md">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className={`h-12 w-12 rounded bg-${action.color}-100 flex items-center justify-center flex-shrink-0`}>
                          <Icon className={`h-6 w-6 text-${action.color}-600`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h3 className="font-medium text-foreground truncate">{action.title}</h3>
                            {action.badge && action.badge > 0 && (
                              <Badge variant="destructive" className="ml-2">
                                {action.badge}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">{action.description}</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>

          {/* Profile Completeness */}
          <Card>
            <CardHeader>
              <CardTitle>Profile Completeness</CardTitle>
              <CardDescription>
                Complete your profile to increase visibility and attract more clients
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Basic Information</p>
                    <p className="text-sm text-muted-foreground">Company details, contact information</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={currentBroker.displayName ? "outline" : "secondary"} className={currentBroker.displayName ? "bg-green-50 text-green-700 border-green-200" : "bg-yellow-50 text-yellow-700 border-yellow-200"}>
                      {currentBroker.displayName ? "Complete" : "Incomplete"}
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Verification Status</p>
                    <p className="text-sm text-muted-foreground">Verify your profile to build trust</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={status.color as BadgeVariant}>
                      <status.icon className="h-3 w-3 mr-1" />
                      {status.label}
                    </Badge>
                    {currentBroker.verificationStatus === 'UNVERIFIED' && (
<Button size="sm" variant="outline" asChild>
                          <Link href="/broker/profile">
                            Verify Profile
                          </Link>
                        </Button>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Overall Profile Progress</span>
                    <span className="text-sm font-semibold text-primary">
                      {calculateProfileCompletion()}%
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${calculateProfileCompletion()}%` }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Contact Info */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Contact Info</CardTitle>
              <CardDescription>
                Contact information shown to clients
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 border rounded">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{currentBroker.phone || 'Not provided'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 border rounded">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{currentBroker.email || currentBroker.user?.email || 'Not provided'}</p>
                  </div>
                </div>
                {currentBroker.whatsapp && (
                  <div className="flex items-center gap-3 p-3 border rounded">
                    <MessageSquare className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">WhatsApp</p>
                      <p className="font-medium">{currentBroker.whatsapp}</p>
                    </div>
                  </div>
                )}
                {currentBroker.website && (
                  <div className="flex items-center gap-3 p-3 border rounded">
                    <Globe className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Website</p>
                      <p className="font-medium truncate">{currentBroker.website}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contacts">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle>Contact Messages</CardTitle>
<CardDescription>
                  Messages from potential clients interested in your services
                </CardDescription>
                </div>
                <Button asChild>
                  <Link href="/broker/messages">
                    View All Messages
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {contacts?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p>No contact messages at this time. Complete your profile to start receiving inquiries.</p>
                  <Button className="mt-4" asChild>
                    <Link href="/broker/profile/edit">
                      <Plus className="mr-2 h-4 w-4" />
                      Complete Profile
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {contacts?.slice(0, 5).map((message: DashboardContact) => (
                    <div key={message.id} className="flex items-start justify-between p-3 border rounded hover:bg-muted">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium truncate">{message.name}</p>
                          <Badge variant="outline" className="capitalize text-xs">
                            {message.contactType}
                          </Badge>
                          {!message.isRead && (
                            <Badge variant="destructive" className="text-xs">
                              New
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{message.message}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(message.createdAt ?? ''), 'MMM d, h:mm a')}
                          </span>
                          {message.loanAmount && (
                            <span className="text-xs font-medium">
                               ${message.loanAmount.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" asChild>
                        <Link href={`/broker/messages?contactId=${message.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reviews">
          <Card>
            <CardHeader>
              <CardTitle>Client Reviews</CardTitle>
<CardDescription>
                  What clients are saying about our services
                </CardDescription>
            </CardHeader>
            <CardContent>
              {(currentBroker.reviews?.length || 0) === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Star className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p>No reviews at this time. Reviews will appear here when clients rate your services.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {currentBroker.reviews.slice(0, 5).map((review: DashboardReview) => (
                    <div key={review.id || String(review.createdAt ?? '')} className="rounded border p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{review.user?.name || 'Client review'}</span>
                        <span aria-label={`${review.rating} out of 5 stars`}>{review.rating}/5</span>
                      </div>
                      {review.comment && <p className="mt-2 text-sm text-muted-foreground">{review.comment}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle>Analytics Dashboard</CardTitle>
                  <CardDescription>
                    Performance metrics and insights about your profile
                  </CardDescription>
                </div>
                {currentAnalytics?.analytics && (
                  <div className="flex items-center gap-2">
                    <select
                      value={timeRange}
                      onChange={(e) => setTimeRange(e.target.value)}
                      className="px-3 py-2 border rounded-md text-sm"
                    >
                      <option value="7days">Last 7 days</option>
                      <option value="30days">Last 30 days</option>
                      <option value="90days">Last 90 days</option>
                      <option value="1year">Last year</option>
                    </select>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {currentAnalytics?.requiresSubscription ? (
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-primary/10 to-primary/20 mb-4">
                    <BarChart3 className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Explore Analytics Plans</h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    View detailed insights into your profile performance, contact trends, and client behavior with our premium analytics dashboard.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button asChild className="gap-2">
                      <Link href="/broker/subscription">
                        <TrendingUp className="h-4 w-4" />
                        View Subscription Plans
                      </Link>
                    </Button>
                    <Button variant="outline" asChild>
                      <Link href="/broker/profile">
                        Complete Your Profile
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : currentAnalytics?.analytics ? (
                <div className="space-y-6">
                  {/* Summary Cards */}
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Total Messages</p>
                            <p className="text-2xl font-bold">{currentAnalytics.analytics.summary.totalContacts}</p>
                          </div>
                          <div className="h-10 w-10 rounded bg-blue-100 flex items-center justify-center">
                            <MessageSquare className="h-5 w-5 text-info" />
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          {currentAnalytics.analytics.summary.period} period
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Response Rate</p>
                            <p className="text-2xl font-bold">{currentAnalytics.analytics.summary.responseRate}%</p>
                          </div>
                          <div className="h-10 w-10 rounded bg-green-100 flex items-center justify-center">
                            <CheckCircle className="h-5 w-5 text-success" />
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          {currentAnalytics.analytics.summary.respondedContacts} of {currentAnalytics.analytics.summary.totalContacts} responded
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Avg. Response Time</p>
                            <p className="text-2xl font-bold">{currentAnalytics.analytics.performance.avgResponseTime}</p>
                          </div>
                          <div className="h-10 w-10 rounded bg-purple-100 flex items-center justify-center">
                            <Clock className="h-5 w-5 text-purple-600" />
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          Faster than 75% of mortgage originators
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Client Satisfaction</p>
                            <p className="text-2xl font-bold">{(currentAnalytics.analytics.performance.satisfactionScore ?? 0).toFixed(1)}</p>
                          </div>
                          <div className="h-10 w-10 rounded bg-yellow-100 flex items-center justify-center">
                            <Star className="h-5 w-5 text-warning" />
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          Based on {currentBroker?.totalReviews || 0} reviews
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Charts */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Message Trends</CardTitle>
                      <CardDescription>
                        Daily contact messages over time
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="h-80">
                      {/* You can add a chart library here like Recharts or Chart.js */}
                      <div className="flex items-end justify-between h-full pt-8 border-t">
                         {currentAnalytics.analytics?.charts?.dailyContacts.map((day: { date?: string; count: number }, index: number) => (
                          <div key={index} className="flex flex-col items-center">
                            <div
                              className="w-8 bg-primary rounded-t-lg transition-all duration-300 hover:bg-primary/80"
                              style={{
                                height: `${Math.max(10, (day.count / Math.max(...(currentAnalytics.analytics?.charts?.dailyContacts ?? []).map((d: { date?: string; count: number }) => d.count))) * 200)}px`
                              }}
                            />
                            <span className="text-xs mt-2 text-muted-foreground">
                              {new Date(day.date ?? '').getDate()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Insights */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle>Popular Loan Types</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                           {currentAnalytics.analytics.insights.popularLoanTypes.map((loanType: { type: string; count: number }, index: number) => (
                            <div key={index} className="flex items-center justify-between">
                              <span className="text-sm">{loanType.type}</span>
                              <div className="flex items-center gap-3">
                                <span className="font-medium">{loanType.count}</span>
                                <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-primary"
                                    style={{
                                      width: `${(loanType.count / (currentAnalytics.analytics?.summary.totalContacts ?? 1)) * 100}%`
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Top Cities</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                           {currentAnalytics.analytics.insights.topCities.map((city: { city: string; count: number }, index: number) => (
                            <div key={index} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">{city.city}</span>
                              </div>
                              <Badge variant="outline">{city.count}</Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p>Detailed analytics will appear here as more profile activity is collected.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
