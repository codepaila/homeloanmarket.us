'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check } from 'lucide-react'

type CompanyAdvertisingPlan = {
  id: string
  name: string
  description: string | null
  price: number
  billingInterval: string
  features: string[]
}

export default function CompanySubscriptionSelectPage() {
  const router = useRouter()
  const [plans, setPlans] = useState<CompanyAdvertisingPlan[]>([])
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loadingPlans, setLoadingPlans] = useState(true)
  const [couponCode, setCouponCode] = useState('')
  const [couponMessage, setCouponMessage] = useState('')
  const [couponApplied, setCouponApplied] = useState(false)

  async function applyCoupon() {
    if (!couponCode.trim()) return
    const response = await fetch('/api/company/subscription/coupon/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: couponCode }),
    })
    const data = await response.json()
    if (data.valid) {
      setCouponApplied(true)
      setCouponMessage('Coupon applied.')
    } else {
      setCouponApplied(false)
      setCouponMessage(data.reason || 'Invalid coupon code')
    }
  }

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const response = await fetch('/api/company/subscription/plans')
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Unable to load plans')
        if (active) setPlans(Array.isArray(data.plans) ? data.plans : [])
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load plans')
      } finally {
        if (active) setLoadingPlans(false)
      }
    }
    load()
    return () => { active = false }
  }, [])

  async function select(plan: CompanyAdvertisingPlan) {
    setLoading(plan.id)
    setError('')
    try {
      const response = await fetch('/api/company/subscription/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.id, couponCode: couponApplied ? couponCode : '' }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to start checkout')
      if (data.url) window.location.assign(data.url)
      else router.push('/company/dashboard')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to start checkout')
      setLoading(null)
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-bold text-foreground">Choose your advertising plan</h1>
          <p className="mt-3 text-muted-foreground">
            Select a company advertising plan to request local broker-listing advertisements.
          </p>
        </div>
        <div className="mx-auto mt-6 max-w-2xl">
          <div className="flex gap-2">
            <input
              value={couponCode}
              onChange={(event) => setCouponCode(event.target.value)}
              placeholder="Coupon code"
              className="flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
            />
            <button type="button" onClick={applyCoupon} className="rounded-xl border px-4 py-2.5 text-sm font-semibold">Apply</button>
          </div>
          {couponMessage && <p className="mt-2 text-sm text-muted-foreground">{couponMessage}</p>}
        </div>
        {error && <p className="mx-auto mt-6 max-w-2xl rounded-lg bg-destructive/10 p-3 text-center text-sm text-destructive">{error}</p>}
        {loadingPlans ? (
          <p className="mt-10 text-center text-sm text-muted-foreground">Loading plans…</p>
        ) : plans.length === 0 ? (
          <p className="mt-10 text-center text-sm text-muted-foreground">No advertising plans are currently available.</p>
        ) : (
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {plans.map((plan) => (
              <div key={plan.id} className="flex flex-col rounded-2xl border bg-card p-6">
                <h2 className="text-xl font-semibold">{plan.name}</h2>
                {plan.description && <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>}
                <div className="my-5 flex items-baseline gap-1">
                  <span className="text-4xl font-bold">${(plan.price / 100).toFixed(2)}</span>
                  <span className="text-sm text-muted-foreground">/{plan.billingInterval}</span>
                </div>
                <ul className="mb-6 space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={loading === plan.id}
                  onClick={() => select(plan)}
                  className="mt-auto w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {loading === plan.id ? 'Starting checkout…' : 'Select plan'}
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="mt-8 text-center text-sm text-muted-foreground">
          <Link href="/company/dashboard" className="font-medium text-primary hover:underline">Skip for now</Link>
        </p>
      </div>
    </main>
  )
}
