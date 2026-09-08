// app/broker/subscription/success/page.tsx
'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
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
import { useBrokerChromeResync } from '@/hooks/useSubscription'
import { brokerPlanDisplayName } from '@/lib/broker-plan-display'

function SubscriptionSuccessContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const resync = useBrokerChromeResync()
  const [planName, setPlanName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const verifyingRef = useRef(false)

  const verifySubscription = async (sessionId: string) => {
    // Guard against duplicate verification (rapid navigation / React strict
    // mode double effects) so the webhook reconciliation is not re-run.
    if (verifyingRef.current) return
    verifyingRef.current = true
    try {
      const response = await fetch(`/api/subscription/verify?session_id=${sessionId}`)
      const data = await response.json()
      
      if (data.success) {
        setPlanName(data.data.planName)
        setLoading(false)
        toast.success('Subscription activated successfully!')
        // The verify route reconciled the database with the paid Stripe
        // subscription, so this is the authoritative state. Re-render the
        // server components (header badge) and revalidate the client-side
        // subscription queries so the new plan shows immediately.
        resync()
      } else {
        setLoading(false)
        toast.error('Failed to verify subscription')
      }
    } catch (error) {
      setLoading(false)
      toast.error('Error verifying subscription')
      console.error(error)
    }
  }

  useEffect(() => {
    const session_id = searchParams.get('session_id')
    if (!session_id) {
      router.push('/broker/subscription')
      return
    }

    verifySubscription(session_id)
  }, [searchParams, router])

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
                Thank you for subscribing to {planName ? brokerPlanDisplayName(planName) : 'Premium'}
              </p>
              <p className="text-muted-foreground">
                Your account has been upgraded successfully
              </p>
            </div>

           

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