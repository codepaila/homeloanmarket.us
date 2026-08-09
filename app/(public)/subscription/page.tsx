'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import { AnimatedContainer } from '@/components/design/AnimatedContainer'
import { Section } from '@/components/design/Section'
import { PricingCard } from '@/components/design/PricingCard'
import { subscriptionPlans } from '@/lib/stripe'
import { Check, Star, Zap, Shield, BarChart3 } from 'lucide-react'

export default function SubscriptionPage() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)

  const handleSelect = async (priceId: string, planName: string) => {
    setLoadingPlan(planName)
    try {
      const response = await fetch('/api/subscription/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, plan: planName }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Checkout failed')
      }

      if (data.url) {
        window.location.href = data.url
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to start checkout')
    } finally {
      setLoadingPlan(null)
    }
  }

  return (
    <div className="min-h-screen">
              <Section className="bg-surface">
        <AnimatedContainer>
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="heading-1 text-text-main mb-4">
              Choose Your Plan
            </h1>
            <p className="text-xl text-text-muted">
              Simple, transparent pricing designed for mortgage brokers of all sizes. Start with our free plan
              or upgrade to get featured placement and advanced tools.
            </p>
          </div>
        </AnimatedContainer>
      </Section>

      <Section className="bg-background">
        <AnimatedContainer>
          <div className="grid lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {subscriptionPlans.map((plan, index) => (
              <PricingCard
                key={plan.name}
                name={plan.name}
                description={plan.description}
                price={plan.price}
                features={plan.features}
                limits={Object.fromEntries(
                  Object.entries(plan.limits).filter(([, v]) => v !== undefined)
                )}
                isPopular={plan.name === 'FEATURED'}
                stripePriceId={plan.stripePriceId}
                onSelect={handleSelect}
                isCurrent={plan.name === 'FREE'}
              />
            ))}
          </div>
        </AnimatedContainer>
      </Section>

      <Section className="bg-surface/30">
        <AnimatedContainer>
          <div className="max-w-4xl mx-auto">
            <h2 className="heading-3 text-center text-text-main mb-8">
              What&apos;s Included
            </h2>
            <div className="grid md:grid-cols-3 gap-8 text-center">
              <div className="space-y-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-text-main">Verified Listing</h3>
                <p className="text-sm text-text-muted">
                  All plans include basic mortgage broker listing with verification badge
                </p>
              </div>
              <div className="space-y-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <BarChart3 className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-text-main">Analytics</h3>
                <p className="text-sm text-text-muted">
                  Track profile views, lead performance, and more
                </p>
              </div>
              <div className="space-y-3">
                <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
                  <Zap className="h-6 w-6 text-accent" />
                </div>
                <h3 className="font-semibold text-text-main">Priority Support</h3>
                <p className="text-sm text-text-muted">
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
            <h2 className="heading-3 text-text-main mb-4">
              Have questions about our plans?
            </h2>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 text-primary hover:text-primary font-medium transition-colors"
            >
               Contact our team
            </Link>
          </div>
        </AnimatedContainer>
      </Section>
    </div>
  )
}
