'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PricingCard } from '@/components/design/PricingCard'

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

export default function BrokerRegistrationSubscriptionPage() {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [plans, setPlans] = useState<PublicPlan[]>([])

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const response = await fetch('/api/subscription/plans')
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Unable to load plans')
        if (active) setPlans(Array.isArray(data.plans) ? data.plans : [])
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load plans')
      }
    }
    void load()
    return () => { active = false }
  }, [])

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
            <PricingCard
              key={plan.id}
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
          ))}
        </div>
        )}
      </div>
    </main>
  )
}