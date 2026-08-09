'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Building,
  Phone,
  Mail,
  MapPin,
  Globe,
  Shield,
  Star,
  Award,
  Users,
  Banknote,
  Briefcase,
  Clock,
  Edit,
  Share2,
  Download,
  CheckCircle,
  XCircle,
  Eye,
  MessageSquare,
  Languages
} from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'

interface BrokerProfileProps {
  user: any
}

export function BrokerProfile({ user }: BrokerProfileProps) {
  const [activeTab, setActiveTab] = useState('overview')
  
  const broker = user.brokerProfile
  const subscription = broker.subscription

  const verificationStatusConfig = {
    UNVERIFIED: { label: "Unverified", color: "secondary", icon: XCircle, description: "Complete verification to get verified badge" },
    PENDING: { label: "Pending Verification", color: "warning", icon: Clock, description: "Your profile is under review" },
    VERIFIED: { label: "Verified Mortgage Broker", color: "success", icon: CheckCircle, description: "Your profile is verified and active" },
  }

  const brokerStatusConfig = {
    FREE: { label: "Free Plan", color: "secondary", icon: Building },
    FEATURED: { label: "Featured Mortgage Broker", color: "primary", icon: Star },
    SUSPENDED: { label: "Suspended", color: "destructive", icon: XCircle },
  }

  const verificationStatus = verificationStatusConfig[(broker?.verificationStatus || 'UNVERIFIED') as keyof typeof verificationStatusConfig]
  const commercialStatus = broker?.brokerStatus === 'SUSPENDED'
    ? 'SUSPENDED'
    : broker?.subscription?.isActive && broker.subscription.plan !== 'FREE'
      ? broker.subscription.plan
      : 'FREE'
  const brokerStatus = brokerStatusConfig[commercialStatus as keyof typeof brokerStatusConfig]

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="bg-gradient-to-r from-primary to-primary/80 rounded-xl p-6 text-white">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between">
          <div className="flex items-start gap-4">
            {broker?.logo ? (
              <img 
                src={broker.logo} 
                alt={broker.companyName} 
                className="h-20 w-20 rounded-xl border-4 border-white/20"
              />
            ) : (
              <div className="h-20 w-20 rounded-xl bg-white/20 flex items-center justify-center">
                <Building className="h-10 w-10" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold">{broker?.displayName}</h1>
              {broker?.companyName && (
                <p className="text-white/80">{broker.companyName}</p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="secondary" className="bg-white/20">
                  <verificationStatus.icon className="h-3 w-3 mr-1" />
                  {verificationStatus.label}
                </Badge>
                <Badge variant="secondary" className="bg-white/20">
                  <brokerStatus.icon className="h-3 w-3 mr-1" />
                  {brokerStatus.label}
                </Badge>
                <Badge variant="secondary" className="bg-white/20">
                  <Star className="h-3 w-3 mr-1" />
                  {broker?.avgRating?.toFixed(1) || 0} ({broker?.totalReviews || 0} reviews)
                </Badge>
              </div>
              <p className="mt-2 text-white/90">{broker?.description}</p>
            </div>
          </div>
          
          <div className="mt-4 md:mt-0 flex gap-2">
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="reviews">Reviews ({broker?.totalReviews || 0})</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {/* Contact Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{broker?.phone || "Not provided"}</p>
                  </div>
                </div>
                {broker?.whatsapp && (
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">WhatsApp</p>
                      <p className="font-medium">{broker.whatsapp}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{broker?.email || user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Office Address</p>
                    <p className="font-medium">
                      {broker?.officeAddress ? `${broker.officeAddress}, ${broker.city}` : "Not provided"}
                    </p>
                  </div>
                </div>
                {broker?.website && (
                  <div className="flex items-center gap-3">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Website</p>
                      <a 
                        href={broker.website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="font-medium text-primary hover:underline"
                      >
                        {broker.website}
                      </a>
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
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Years of Experience</p>
                    <p className="font-medium">{broker?.experienceYears || 0} years</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Specializations</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {broker?.specializations?.map((spec: string, idx: number) => (
                        <Badge key={idx} variant="outline">{spec}</Badge>
                      )) || <span className="text-muted-foreground">Not specified</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Banknote className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Bank Partnerships</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {broker?.bankPartners?.slice(0, 3).map((bank: any) => (
                        <Badge key={bank.id} variant="secondary">{bank.bankName}</Badge>
                      )) || <span className="text-muted-foreground">Not specified</span>}
                      {broker?.bankPartners?.length > 3 && (
                        <Badge variant="outline">+{broker.bankPartners.length - 3} more</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Service Areas Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Service Areas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Cities Served</p>
                    <div className="flex flex-wrap gap-1">
                      {broker?.serviceCities?.map((city: string, idx: number) => (
                        <Badge key={idx} variant="outline">{city}</Badge>
                      )) || <span className="text-muted-foreground">Not specified</span>}
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Languages</p>
                    <div className="flex flex-wrap gap-1">
                      {broker?.languages?.map((lang: string, idx: number) => (
                        <Badge key={idx} variant="secondary">{lang}</Badge>
                      )) || <span className="text-muted-foreground">English, Hindi</span>}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Additional Information */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Information</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Registration Details</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Registration Number:</span>
                      <span className="font-medium">{broker?.registrationNumber || "Not provided"}</span>
                    </div>
                    <div className="flex justify-between">
                       <span className="text-muted-foreground">Tax ID Number:</span>
                      <span className="font-medium">{broker?.panNumber || "Not provided"}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Subscription Status</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Current Plan:</span>
                      <span className="font-medium">{subscription?.plan || "FREE"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <Badge variant={subscription?.isActive ? "outline" : "secondary"} className={subscription?.isActive ? "bg-green-50 text-green-700 border-green-200" : ""}>
                        {subscription?.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    {subscription?.isActive && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Started:</span>
                          <span className="font-medium">
                            {subscription.startDate ? format(new Date(subscription.startDate), 'MMM d, yyyy') : "N/A"}
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
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Verification Status</h4>
                  <div className={`p-4 rounded-lg border ${verificationStatus.color === 'success' ? 'bg-green-50 border-green-200' : 
                    verificationStatus.color === 'warning' ? 'bg-yellow-50 border-yellow-200' : 
                    'bg-muted border-border'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <verificationStatus.icon className={`h-5 w-5 ${
                        verificationStatus.color === 'success' ? 'text-success' :
                        verificationStatus.color === 'warning' ? 'text-warning' : 'text-muted-foreground'
                      }`} />
                      <span className="font-medium">{verificationStatus.label}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{verificationStatus.description}</p>
                    {broker?.verificationStatus === 'UNVERIFIED' && (
                      <Button size="sm" className="mt-3" asChild>
                        <Link href="/broker/profile/verification">
                          Complete Verification
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Performance Metrics</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Profile Views</span>
                      <span className="font-medium">{broker?.profileViews || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total Leads</span>
                      <span className="font-medium">{broker?.totalLeads || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Monthly Leads</span>
                      <span className="font-medium">{broker?.monthlyLeads || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total Reviews</span>
                      <span className="font-medium">{broker?.totalReviews || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services">
          <Card>
            <CardHeader>
              <CardTitle>Bank Partnerships</CardTitle>
              <CardDescription>
                Manage your bank partnerships and services
              </CardDescription>
            </CardHeader>
            <CardContent>
              {broker?.bankPartners?.length ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {broker.bankPartners.map((bank: any) => (
                    <Card key={bank.id}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium">{bank.bankName}</h4>
                            <p className="text-sm text-muted-foreground">{bank.bankType}</p>
                            {bank.since && (
                              <p className="text-sm text-muted-foreground mt-1">
                                Since: {format(new Date(bank.since), 'MMM yyyy')}
                              </p>
                            )}
                          </div>
                          <Badge variant="outline">
                            {bank.bankType}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 border rounded-lg">
                  <Banknote className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No bank partnerships added</p>
                  <Button className="mt-4" variant="outline" asChild>
                    <Link href="/broker/banks/add">
                      Add Bank Partnership
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reviews">
          <Card>
            <CardHeader>
              <CardTitle>Customer Reviews</CardTitle>
              <CardDescription>
                What your clients are saying about your services
              </CardDescription>
            </CardHeader>
            <CardContent>
              {broker?.reviews?.length ? (
                <div className="space-y-4">
                  {broker.reviews.map((review: any) => (
                    <Card key={review.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                              {review.user?.name?.charAt(0) || "U"}
                            </div>
                            <div>
                              <p className="font-medium">{review.user?.name || "Anonymous"}</p>
                              <div className="flex items-center gap-1">
                                {[...Array(5)].map((_, i) => (
                                  <Star 
                                    key={i} 
                                    className={`h-4 w-4 ${i < review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground'}`}
                                  />
                                ))}
                                <span className="text-sm text-muted-foreground ml-2">
                                  {format(new Date(review.createdAt), 'MMM d, yyyy')}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {review.comment && (
                          <p className="text-muted-foreground mb-3">{review.comment}</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                   <h3 className="text-lg font-medium text-foreground mb-2">No reviews at this time</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    You haven't received any reviews yet. Complete more applications to start getting feedback from clients.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats">
          <Card>
            <CardHeader>
              <CardTitle>Performance Statistics</CardTitle>
              <CardDescription>
                Track your performance metrics over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <h3 className="font-medium">Key Metrics</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 border rounded-lg">
                      <span className="text-muted-foreground">Total Profile Views</span>
                      <span className="font-bold text-lg">{broker?.profileViews || 0}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 border rounded-lg">
                      <span className="text-muted-foreground">Total Leads Received</span>
                      <span className="font-bold text-lg">{broker?.totalLeads || 0}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 border rounded-lg">
                      <span className="text-muted-foreground">Monthly Leads</span>
                      <span className="font-bold text-lg">{broker?.monthlyLeads || 0}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 border rounded-lg">
                      <span className="text-muted-foreground">Total Reviews</span>
                      <span className="font-bold text-lg">{broker?.totalReviews || 0}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium">Rating Breakdown</h3>
                  <div className="space-y-3">
                    {[5, 4, 3, 2, 1].map((rating) => {
                      // Calculate percentage for each rating
                      const totalReviews = broker?.reviews?.length || 0
                      const ratingCount = broker?.reviews?.filter((r: any) => r.rating === rating).length || 0
                      const percentage = totalReviews > 0 ? (ratingCount / totalReviews) * 100 : 0
                      
                      return (
                        <div key={rating} className="flex items-center gap-3">
                          <div className="flex items-center gap-1 w-16">
                            <Star className="h-4 w-4 text-yellow-400" />
                            <span className="font-medium">{rating}</span>
                          </div>
                          <div className="flex-1 bg-muted rounded-full h-2">
                            <div 
                              className="bg-yellow-400 h-2 rounded-full" 
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="text-sm text-muted-foreground w-10 text-right">
                            {Math.round(percentage)}%
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  <div className="pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Overall Rating</span>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold">{broker?.avgRating?.toFixed(1) || 0}</span>
                        <Star className="h-6 w-6 text-yellow-400 fill-yellow-400" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
