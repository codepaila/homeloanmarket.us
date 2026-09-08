// components/sections/broker/BrokerDashboard.tsx
'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Building,
  AlertCircle,
  ArrowRight,
  MapPin,
  Phone,
  Mail,
  MessageSquare,
  Globe,
  Calendar,
  Briefcase,
  Star,
  ShieldCheck,
  FileText,
  Pencil,
  CreditCard,
  Eye,
} from 'lucide-react'
import Link from 'next/link'
import { useMyBrokerProfile } from '@/hooks/useClient'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { US_STATES } from '@/lib/us-states'
import toast from 'react-hot-toast'

interface DashboardBroker {
  id: string
  displayName: string
  companyName?: string | null
  description: string
  profileSlug: string
  logo?: string | null
  phone: string
  email?: string | null
  whatsapp?: string | null
  website?: string | null
  officeAddress: string
  city?: string | null
  state?: string | null
  pinCode?: string | null
  experienceYears: number
  nmls?: string | null
  licenseStates?: string[]
  brokerStatus: string
  verificationStatus: string
  creationSource?: string | null
  user?: { name?: string | null; email?: string | null; phone?: string | null; image?: string | null } | null
  subscription?: { plan?: string; isActive?: boolean } | null
}

interface BrokerDashboardProps {
  initialData?: {
    broker?: DashboardBroker
  }
}

export function BrokerDashboard({ initialData }: BrokerDashboardProps) {
  const user = useCurrentUser()
  const [isResending, setIsResending] = useState(false)
  const { data: broker, isLoading: isLoadingBroker } = useMyBrokerProfile()

  const currentBroker = (broker as DashboardBroker | undefined) || initialData?.broker

  const commercialStatus = currentBroker?.brokerStatus === 'SUSPENDED'
    ? 'SUSPENDED'
    : currentBroker?.subscription?.isActive && currentBroker.subscription.plan !== 'FREE'
      ? (currentBroker.subscription.plan || 'FREE')
      : 'FREE'

  const planConfig = {
    FREE: { label: 'Free', color: 'secondary' as const, icon: Building },
    FEATURED: { label: "Mortgage Expert", color: 'default' as const, icon: Star },
    SUSPENDED: { label: 'Suspended', color: 'destructive' as const, icon: AlertCircle },
  }
  const plan = planConfig[commercialStatus as keyof typeof planConfig] || planConfig.FREE

  // Profile completion is scored from the professional identity, contact and
  // office details only. It never includes cover images or performance
  // counters, so the number reflects how complete the public-facing profile is.
  const profileCompletion = (() => {
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
      currentBroker.nmls,
      (currentBroker.licenseStates?.length || 0) > 0,
    ]
    const completed = fields.filter(Boolean).length
    return Math.round((completed / fields.length) * 100)
  })()

  const quickActions = [
    {
      title: 'Update Profile',
      description: 'Edit your professional company profile',
      href: '/broker/company/edit',
      icon: Pencil,
    },
    {
      title: 'View Public Profile',
      description: 'See how clients experience your profile',
      href: `/brokers/${currentBroker?.profileSlug || ''}`,
      icon: Eye,
    },
    {
      title: 'Subscription & Plan',
      description: 'Manage your plan and subscription',
      href: '/broker/subscription',
      icon: CreditCard,
    },
    // {
    //   title: 'Messages',
    //   description: 'Review messages from home buyers',
    //   href: '/broker/messages',
    //   icon: MessageSquare,
    // },
  ]

  const handleResendVerification = async () => {
    setIsResending(true)
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user?.email }),
      })
      const data = await response.json()
      if (data.success) {
        toast.success('Verification email sent! Please check your inbox.')
      } else {
        toast.error(data.error || 'Failed to send verification email')
      }
    } catch (error) {
      console.error('Failed to resend verification:', error)
      toast.error('Failed to send verification email')
    } finally {
      setIsResending(false)
    }
  }

  if (isLoadingBroker && !currentBroker) {
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
              <ArrowRight className="mr-2 h-4 w-4" />
              Create Mortgage Originator Profile
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const fullOfficeAddress = [currentBroker.officeAddress].filter(Boolean).join(', ')
  // const fullOfficeAddress = [currentBroker.officeAddress, currentBroker.city, currentBroker.state, currentBroker.pinCode].filter(Boolean).join(', ')

  return (
    <div className="space-y-6">
      {/* Identity header */}
      <div className="bg-gradient-to-r from-primary to-primary/80 rounded p-6 text-white">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex flex-1 items-start gap-4 min-w-0">
            {currentBroker.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
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
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold truncate">{currentBroker.displayName}</h1>
              {currentBroker.companyName && (
                <p className="text-white/80">{currentBroker.companyName}</p>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <Badge variant="secondary" className="bg-white/20 hover:bg-white/30">
                  <plan.icon className="h-3 w-3 mr-1" />
                  {plan.label}
                </Badge>
                {currentBroker.verificationStatus === 'VERIFIED' && (
                  <Badge variant="secondary" className="bg-white/20 hover:bg-white/30">
                    <ShieldCheck className="h-3 w-3 mr-1" />
                    Verified
                  </Badge>
                )}
                {currentBroker.city && (
                  <Badge variant="secondary" className="bg-white/20 hover:bg-white/30">
                    <MapPin className="h-3 w-3 mr-1" />
                    {currentBroker.city}
                  </Badge>
                )}
                <Badge variant="secondary" className="bg-white/20 hover:bg-white/30">
                  <Calendar className="h-3 w-3 mr-1" />
                  {currentBroker.experienceYears || 0} yrs
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {user?.emailVerified === false && (
              <Button
                type="button"
                variant="secondary"
                className="gap-2"
                onClick={handleResendVerification}
                disabled={isResending}
              >
                <AlertCircle className="h-4 w-4" />
                {isResending ? 'Sending Verification...' : 'Verify Your Email'}
              </Button>
            )}
            <Button variant="outline" className="gap-2 bg-white/10 border-white/20 text-white hover:bg-white/20" asChild>
              <Link href="/broker/company/edit">
                <Pencil className="h-4 w-4" />
                Edit Profile
              </Link>
            </Button>
            <Button variant="outline" className="gap-2 bg-white/10 border-white/20 text-white hover:bg-white/20" asChild>
              <Link href={`/brokers/${currentBroker.profileSlug}`}>
                <FileText className="h-4 w-4" />
                View Public Profile
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Broker verification status — shown only for SELF_REGISTERED brokers
          awaiting admin review. Once verified, the header "Verified" badge
          communicates the state; the redundant verified success card is
          intentionally not rendered. */}
      {currentBroker.creationSource === 'SELF_REGISTERED' && currentBroker.verificationStatus !== 'VERIFIED' && (
        <Card className="border-warning/40">
          <CardContent className="p-4 flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 mt-0.5 text-warning" aria-hidden="true" />
            <div className="space-y-0.5">
              <p className="text-sm font-semibold">Verification Under Review</p>
              <p className="text-sm text-muted-foreground">
                Your broker profile is currently being reviewed by our team. Your profile will become available in the public broker directory after an administrator verifies your account.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {quickActions.map((action) => {
          const Icon = action.icon
          return (
            <Link key={action.title} href={action.href}>
              <Card className="h-full hover:border-primary transition-colors cursor-pointer hover:shadow-md">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded bg-primary/10 flex-shrink-0">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-foreground truncate">{action.title}</h3>
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

      {/* Profile + contact details */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Professional information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Professional Information
            </CardTitle>
            <CardDescription>
              Licensing and experience details shown to clients
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">NMLS ID</p>
                <p className="font-medium">{currentBroker.nmls || 'Not provided'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Years of Experience</p>
                <p className="font-medium">{currentBroker.experienceYears || 0} years</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Licensed States</p>
                {currentBroker.licenseStates && currentBroker.licenseStates.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {currentBroker.licenseStates.map((code) => (
                      <Badge key={code} variant="outline" className="capitalize">
                        {US_STATES.find((state) => state.code === code)?.name || code}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="font-medium">Not provided</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Contact Information
            </CardTitle>
            <CardDescription>
              Contact details shown to clients
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium">{currentBroker.phone || 'Not provided'}</p>
              </div>
            </div>
            {currentBroker.whatsapp && (
              <div className="flex items-center gap-3">
                <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">WhatsApp</p>
                  <p className="font-medium">{currentBroker.whatsapp}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium truncate">{currentBroker.email || currentBroker.user?.email || 'Not provided'}</p>
              </div>
            </div>
            {currentBroker.website && (
              <div className="flex items-center gap-3">
                <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Website</p>
                  <p className="font-medium truncate">{currentBroker.website}</p>
                </div>
              </div>
            )}
            {fullOfficeAddress && (
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Office Address</p>
                  <p className="font-medium">{fullOfficeAddress}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Profile completeness */}
      {/* <Card>
        <CardHeader>
          <CardTitle>Profile Completeness</CardTitle>
          <CardDescription>
            Complete your profile to increase visibility and attract more clients
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Overall Profile Progress</span>
            <span className="text-sm font-semibold text-primary">
              {profileCompletion}%
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${profileCompletion}%` }}
            />
          </div>
        </CardContent>
      </Card> */}
    </div>
  )
}