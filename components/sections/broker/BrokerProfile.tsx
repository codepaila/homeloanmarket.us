'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Building,
  Phone,
  Mail,
  MapPin,
  Globe,
  Star,
  Briefcase,
  Clock,
  Edit,
  XCircle,
  Eye,
  MessageSquare,
  ShieldCheck,
  Calendar,
} from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { US_STATES } from '@/lib/us-states'
import { brokerPlanDisplayName } from '@/lib/broker-plan-display'

interface BrokerProfileData {
  id?: string
  displayName?: string
  companyName?: string | null
  description?: string
  profileSlug?: string
  logo?: string | null
  phone?: string
  email?: string | null
  website?: string | null
  whatsapp?: string | null
  officeAddress?: string
  city?: string | null
  state?: string | null
  pinCode?: string | null
  experienceYears?: number
  nmls?: string | null
  licenseStates?: string[]
  brokerStatus?: string
  subscription?: { plan?: string; isActive?: boolean; startDate?: string | Date | null; endDate?: string | Date | null } | null
}

interface BrokerProfileProps {
  user: {
    id: string
    email?: string | null
    name?: string | null
    image?: string | null
    brokerProfile: BrokerProfileData
  }
}

export function BrokerProfile({ user }: BrokerProfileProps) {
  const broker = user.brokerProfile
  const subscription = broker.subscription

  const brokerStatusConfig = {
    FREE: { label: 'Free', color: 'secondary', icon: Building },
    FEATURED: { label: "Mortgage Expert", color: 'primary', icon: Star },
    SUSPENDED: { label: 'Suspended', color: 'destructive', icon: XCircle },
  }

  const commercialStatus = broker?.brokerStatus === 'SUSPENDED'
    ? 'SUSPENDED'
    : broker?.subscription?.isActive && broker.subscription.plan !== 'FREE'
      ? broker.subscription.plan
      : 'FREE'
  const activePlan = brokerStatusConfig[commercialStatus as keyof typeof brokerStatusConfig]

  const fullOfficeAddress = [broker?.officeAddress].filter(Boolean).join(', ')
  // const fullOfficeAddress = [broker?.officeAddress, broker?.city, broker?.state, broker?.pinCode].filter(Boolean).join(', ')

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="bg-gradient-to-r from-primary to-primary/80 rounded p-6 text-white">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex flex-1 items-start gap-4 min-w-0">
            {broker?.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={broker.logo}
                alt={broker.companyName ?? undefined}
                className="h-20 w-20 rounded border-4 border-white/20 object-cover"
              />
            ) : (
              <div className="h-20 w-20 rounded bg-white/20 flex items-center justify-center">
                <Building className="h-10 w-10" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold truncate">{broker?.displayName}</h1>
              {broker?.companyName && (
                <p className="text-white/80">{broker.companyName}</p>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge variant="secondary" className="bg-white/20">
                  <activePlan.icon className="h-3 w-3 mr-1" />
                  {activePlan.label}
                </Badge>
                {broker?.city && (
                  <Badge variant="secondary" className="bg-white/20">
                    <MapPin className="h-3 w-3 mr-1" />
                    {broker.city}
                  </Badge>
                )}
                <Badge variant="secondary" className="bg-white/20">
                  <Calendar className="h-3 w-3 mr-1" />
                  {broker?.experienceYears || 0} yrs
                </Badge>
              </div>
              {broker?.description && (
                <p className="mt-2 text-white/90 text-sm">{broker.description}</p>
              )}
            </div>
          </div>

          <div className="mt-4 md:mt-0 flex flex-wrap gap-2">
            <Button variant="secondary" className="gap-2" asChild>
              <Link href={`/brokers/${broker?.profileSlug}`}>
                <Eye className="h-4 w-4" />
                View Public Profile
              </Link>
            </Button>
            <Button variant="outline" className="gap-2 bg-white/10 border-white/20 text-white hover:bg-white/20" asChild>
              <Link href="/broker/company/edit">
                <Edit className="h-4 w-4" />
                Edit Profile
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Contact Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Contact Information
            </CardTitle>
            <CardDescription>
              How clients reach you
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium">{broker?.phone || 'Not provided'}</p>
              </div>
            </div>
            {broker?.whatsapp && (
              <div className="flex items-center gap-3">
                <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">WhatsApp</p>
                  <p className="font-medium">{broker.whatsapp}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium truncate">{broker?.email || user.email}</p>
              </div>
            </div>
            {broker?.website && (
              <div className="flex items-center gap-3">
                <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Website</p>
                  <a
                    href={broker.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary hover:underline break-all"
                  >
                    {broker.website}
                  </a>
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

        {/* Professional Details Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Professional Details
            </CardTitle>
            <CardDescription>
              Licensing and experience information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Years of Experience</p>
                <p className="font-medium">{broker?.experienceYears || 0} years</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">NMLS ID</p>
                <p className="font-medium">{broker?.nmls || 'Not provided'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Licensed States</p>
                {broker?.licenseStates && broker.licenseStates.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {broker.licenseStates.map((code) => (
                      <Badge key={code} variant="outline">
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
      </div>

      {/* Subscription Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Subscription Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Current Plan:</span>
            <span className="font-medium">{brokerPlanDisplayName(subscription?.plan)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status:</span>
            <Badge variant={subscription?.isActive ? 'outline' : 'secondary'} className={subscription?.isActive ? 'bg-green-50 text-green-700 border-green-200' : ''}>
              {subscription?.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          {subscription?.isActive && (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Started:</span>
                <span className="font-medium">
                  {subscription.startDate ? format(new Date(subscription.startDate), 'MMM d, yyyy') : 'N/A'}
                </span>
              </div>
              {subscription.endDate && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Renews:</span>
                  <span className="font-medium">
                    {format(new Date(subscription.endDate), 'MMM d, yyyy')}
                  </span>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}