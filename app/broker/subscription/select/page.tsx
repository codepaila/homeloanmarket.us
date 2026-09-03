'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { PricingCard } from '@/components/design/PricingCard'
import { cn } from '@/lib/utils'

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
  isActive: boolean
  features: string[]
}

const VALID_PLAN_CODES = ['FREE', 'FEATURED'] as const

function SubscriptionSelectContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [plans, setPlans] = useState<PublicPlan[]>([])
  const [selectedPlanCode, setSelectedPlanCode] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const response = await fetch('/api/subscription/plans')
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Unable to load plans')
        if (!active) return
        const loadedPlans = Array.isArray(data.plans) ? data.plans : []
        setPlans(loadedPlans)

        const planParam = searchParams.get('plan')
        if (
          planParam &&
          (VALID_PLAN_CODES as readonly string[]).includes(planParam) &&
          loadedPlans.some((p: PublicPlan) => p.code === planParam && p.isActive)
        ) {
          setSelectedPlanCode(planParam)
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load plans')
      }
    }
    void load()
    return () => { active = false }
  }, [searchParams])

  async function selectFree() {
    setLoading('FREE')
    setError('')
    try {
      const response = await fetch('/api/broker-registration/subscription/free', { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to select FREE')
      router.push(data.redirectTo || '/setup')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to select FREE')
    } finally {
      setLoading(null)
    }
  }

  async function selectPaid(planCode: string, priceId: string) {
    setLoading(planCode)
    setError('')
    try {
      const response = await fetch('/api/broker-registration/subscription/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planCode, priceId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to start checkout')
      if (data.url) window.location.assign(data.url)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to start checkout')
      setLoading(null)
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-bold text-foreground">Choose your broker plan</h1>
          <p className="mt-3 text-muted-foreground">Select a plan before completing your broker profile.</p>
        </div>
        {error && <p className="mx-auto mt-6 max-w-2xl rounded-lg bg-destructive/10 p-3 text-center text-sm text-destructive">{error}</p>}
        {plans.length === 0 && !error ? (
          <p className="mt-10 text-center text-sm text-muted-foreground">Loading plans…</p>
        ) : (
        <div className="mt-10 grid gap-8 md:grid-cols-2">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                'rounded-2xl transition-all duration-200',
                selectedPlanCode === plan.code && 'ring-2 ring-primary/40',
              )}
            >
              <PricingCard
                name={plan.name}
                description={plan.description || ''}
                price={plan.price / 100}
                priceSuffix={`/${plan.billingInterval}`}
                features={plan.features}
                stripePriceId={plan.stripePriceId || undefined}
                isPopular={plan.code === 'FEATURED'}
                isCurrent={false}
                onSelect={(priceId, planName) => {
                  if (plan.code === 'FREE') void selectFree()
                  else void selectPaid(planName || plan.code, priceId)
                }}
                className={loading === plan.code ? 'pointer-events-none opacity-60' : undefined}
              />
            </div>
          ))}
        </div>
        )}
      </div>
    </main>
  )
}

export default function BrokerRegistrationSubscriptionPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">Loading plans…</p>
          </div>
        </main>
      }
    >
      <SubscriptionSelectContent />
    </Suspense>
  )
}
