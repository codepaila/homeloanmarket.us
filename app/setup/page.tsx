// app/setup/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { BrokerSetupWizard } from '@/components/sections/broker/BrokerSetupWizard'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Building, Users, CheckCircle } from 'lucide-react'

export default function BrokerSetupPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [initialData, setInitialData] = useState<Record<string, unknown>>({})
  const [initialStep, setInitialStep] = useState(1)

  useEffect(() => {
    if (status === 'loading') return

    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    let active = true
    fetch('/api/broker-registration/status')
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Broker registration is not available')
        if (!active) return
        if (data.completed) {
          router.push(data.redirectTo || '/broker/dashboard')
          return
        }
        if (data.subscription?.status !== 'ACTIVE' || !data.subscription?.isActive) {
          router.push('/broker/subscription/select')
          return
        }
        setInitialData(data.draft?.data && typeof data.draft.data === 'object' ? data.draft.data : {})
        setInitialStep(Number.isInteger(data.draft?.currentStep) ? data.draft.currentStep : 1)
        setLoading(false)
      })
      .catch(() => {
        if (active) router.push('/register')
      })

    return () => {
      active = false
    }
  }, [status, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
           <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-3">
            Become a Verified Mortgage Broker
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Join America&apos;s leading mortgage marketplace and connect with thousands of borrowers
          </p>
        </div>

        {/* Benefits Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Card>
            <CardContent className="p-6 text-center">
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
                <Building className="h-6 w-6 text-info" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Get Verified</h3>
              <p className="text-muted-foreground text-sm">
                Verified badge builds trust with borrowers and increases your credibility
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <Users className="h-6 w-6 text-success" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Quality Leads</h3>
              <p className="text-muted-foreground text-sm">
                Receive pre-qualified leads from genuine borrowers looking for loans
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Boost Business</h3>
              <p className="text-muted-foreground text-sm">
                Increase your client base and grow your loan business with our platform
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Setup Wizard */}
         <BrokerSetupWizard user={session?.user} initialData={initialData} initialStep={initialStep} />
      </div>
    </div>
  )
}
