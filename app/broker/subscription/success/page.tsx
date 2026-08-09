// app/broker/subscription/success/page.tsx
'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  CheckCircle, 
  ArrowRight, 
  CreditCard, 
 
} from 'lucide-react'
import { toast } from 'react-hot-toast'

function SubscriptionSuccessContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [planName, setPlanName] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const session_id = searchParams.get('session_id')
    if (!session_id) {
      router.push('/broker/subscription')
      return
    }

    setSessionId(session_id)
    verifySubscription(session_id)
  }, [searchParams, router])

  const verifySubscription = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/subscription/verify?session_id=${sessionId}`)
      const data = await response.json()
      
      if (data.success) {
        setPlanName(data.data.planName)
        toast.success('Subscription activated successfully!')
      } else {
        toast.error('Failed to verify subscription')
      }
    } catch (error) {
      toast.error('Error verifying subscription')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Verifying your subscription...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-muted/40 to-background py-8">
      <div className="container mx-auto px-4 max-w-2xl">
        <Card className="border-none shadow-xl">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <div className="h-20 w-20 rounded-full bg-success/15 flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="h-10 w-10 text-success" />
              </div>
              
              <h1 className="text-3xl font-bold text-foreground mb-3">
                Subscription Activated!
              </h1>
              
              <p className="text-muted-foreground text-lg mb-2">
                Thank you for subscribing to {planName || 'Premium'}
              </p>
              <p className="text-muted-foreground">
                Your account has been upgraded successfully
              </p>
            </div>

            {/* Next Steps */}
            {/* <div className="space-y-6 mb-8">
              <h2 className="text-xl font-semibold text-foreground text-center">
                What Is Next?
              </h2>

              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 border rounded-lg">
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Mail className="h-5 w-5 text-info" />
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground mb-1">Email Confirmation</h3>
                    <p className="text-muted-foreground text-sm">
                      You'll receive a welcome email with your subscription details and next steps
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 border rounded-lg">
                  <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                    <Zap className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground mb-1">Instant Access</h3>
                    <p className="text-muted-foreground text-sm">
                      All premium features are now available in your account
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 border rounded-lg">
                  <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <Users className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground mb-1">Premium Features</h3>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge variant="outline" className="gap-1">
                        <FileText className="h-3 w-3" />
                        More Listings
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <Users className="h-3 w-3" />
                        Team Members
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <Building className="h-3 w-3" />
                        Branch Locations
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <Star className="h-3 w-3" />
                        Featured Placement
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </div> */}

            {/* Actions */}
            <div className="space-y-4">
              <Button asChild className="w-full gap-2 py-6 text-lg">
                <Link href="/broker/dashboard">
                  Go to Dashboard
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              
              <Button asChild variant="outline" className="w-full gap-2">
                <Link href="/broker/subscription">
                  <CreditCard className="h-4 w-4" />
                  View Subscription Details
                </Link>
              </Button>
              
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Questions about your subscription?{' '}
                  <Link href="/support" className="text-primary hover:underline">
                    Contact Support
                  </Link>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function SubscriptionSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading subscription...</p>
          </div>
        </div>
      }
    >
      <SubscriptionSuccessContent />
    </Suspense>
  )
}