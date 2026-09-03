'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import { useSession } from 'next-auth/react'
import { AnimatedContainer } from '@/components/design/AnimatedContainer'
import { Section } from '@/components/design/Section'
import { PricingCard } from '@/components/design/PricingCard'
import { Zap, Shield, BarChart3 } from 'lucide-react'

type PublicPlan = {
  id: string
  code: string
  name: string
  description: string | null
  price: number // cents
  currency: string
  billingInterval: string
  displayOrder: number
  stripePriceId: string | null
  features: string[]
}

export default function SubscriptionPage() {
  const { data: session, status } = useSession()
  const [plans, setPlans] = useState<PublicPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const response = await fetch('/api/subscription/plans')
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Unable to load plans')
        if (active) setPlans(Array.isArray(data.plans) ? data.plans : [])
          
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load plans')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [])

  const handleSelect = (priceId: string, planName: string, planCode?: string) => {
    // Guard against unknown plans — use the plan code from the card
    const code = planCode && (planCode === 'FREE' || planCode === 'FEATURED')
      ? planCode
      : null
    const isAuth = status === 'authenticated' && session?.user?.id

    if (isAuth && code) {
      // Authenticated: redirect to the authenticated subscription select page
      // so the existing paid/free subscription flow runs as intended.
      window.location.href = `/broker/subscription/select?plan=${code}`
      return
    }

    // Unauthenticated (or edge case without session):
    // redirect to signup with the plan code preserved through the broker-intent
    // cookie mechanism. The plan code must be an exact internal identity (FREE /
    // FEATURED) — never a display name or Stripe price ID.
    if (code) {
      window.location.href = `/auth/signup?plan=${code}`
    } else {
      toast.error('Unable to determine the selected plan')
    }
  }

  return (
    <div className="min-h-screen">
      <Section className="bg-muted">
        <AnimatedContainer>
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="heading-1 text-foreground mb-4">
              Choose Your Plan
            </h1>
            <p className="text-xl text-muted-foreground">
              Simple, transparent pricing designed for mortgage originators of all sizes. Start with our free plan
              or upgrade to get Mortgage Expert placement and advanced tools.
            </p>
          </div>
        </AnimatedContainer>
      </Section>

      <Section className="bg-background">
        <AnimatedContainer>
          {loading ? (
            <p className="text-center text-sm text-muted-foreground">Loading plans…</p>
          ) : error ? (
            <p className="text-center text-sm text-destructive">{error}</p>
          ) : plans.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">No plans are currently available.</p>
          ) : (
          <div className="grid lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <PricingCard
                key={plan.id}
                name={plan.name}
                description={plan.description || ''}
                price={plan.price / 100}
                priceSuffix={`/${plan.billingInterval}`}
                features={plan.features}
                isPopular={plan.code === 'FEATURED'}
                stripePriceId={plan.stripePriceId || undefined}
                code={plan.code}
                onSelect={handleSelect}
                isCurrent={false}
              />
            ))}
          </div>
          )}
        </AnimatedContainer>
      </Section>

      <Section className="bg-muted/30">
        <AnimatedContainer>
          <div className="max-w-4xl mx-auto">
            <h2 className="heading-3 text-center text-foreground mb-8">
              What&apos;s Included
            </h2>
            <div className="grid md:grid-cols-3 gap-8 text-center">
              <div className="space-y-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground">Verified Listing</h3>
                <p className="text-sm text-muted-foreground">
                  All plans include basic mortgage originator listing with verification badge
                </p>
              </div>
              <div className="space-y-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <BarChart3 className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground">Analytics</h3>
                <p className="text-sm text-muted-foreground">
                  Track profile views, lead performance, and more
                </p>
              </div>
              <div className="space-y-3">
                <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
                  <Zap className="h-6 w-6 text-accent" />
                </div>
                <h3 className="font-semibold text-foreground">Priority Support</h3>
                <p className="text-sm text-muted-foreground">
                  Get help faster with priority email support
                </p>
              </div>
            </div>
          </div>
        </AnimatedContainer>
      </Section>

      <Section>
        <AnimatedContainer>
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="heading-3 text-foreground mb-4">
              Have questions about our plans?
            </h2>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 text-primary hover:text-primary font-medium transition-colors hover:underline"
            >
               Contact our team
            </Link>
          </div>
        </AnimatedContainer>
      </Section>
    </div>
  )
}
