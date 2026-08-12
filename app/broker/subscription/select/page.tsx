'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { subscriptionPlans } from '@/lib/stripe'
import { PricingCard } from '@/components/design/PricingCard'

export default function BrokerRegistrationSubscriptionPage() {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')

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

  async function selectFeatured(priceId: string) {
    setLoading('FEATURED')
    setError('')
    try {
      const response = await fetch('/api/broker-registration/subscription/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'FEATURED', priceId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to start checkout')
      if (data.url) window.location.href = data.url
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
          <p className="mt-3 text-muted-foreground">Select FREE or FEATURED before completing your broker profile.</p>
        </div>
        {error && <p className="mx-auto mt-6 max-w-2xl rounded-lg bg-destructive/10 p-3 text-center text-sm text-destructive">{error}</p>}
        <div className="mt-10 grid gap-8 md:grid-cols-2">
          {subscriptionPlans.map((plan) => (
            <PricingCard
              key={plan.name}
              name={plan.name}
              description={plan.description}
              price={plan.price}
              features={plan.features}
              limits={Object.fromEntries(Object.entries(plan.limits).filter(([, value]) => value !== undefined))}
              isPopular={plan.name === 'FEATURED'}
              stripePriceId={plan.stripePriceId}
              isCurrent={false}
              onSelect={plan.name === 'FREE' ? () => selectFree() : (priceId) => selectFeatured(priceId)}
              className={loading === plan.name ? 'pointer-events-none opacity-60' : undefined}
            />
          ))}
        </div>
      </div>
    </main>
  )
}
