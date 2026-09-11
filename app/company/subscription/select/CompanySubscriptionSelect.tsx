'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CompanyPlanAndCoupon, type CompanyAdvertisingPlan } from '@/components/company/CompanyPlanAndCoupon'

export function CompanySubscriptionSelect() {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [appliedCouponCode, setAppliedCouponCode] = useState('')

  async function select(plan: CompanyAdvertisingPlan) {
    setLoading(plan.id)
    setError('')
    try {
      const response = await fetch('/api/company/subscription/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.id, couponCode: appliedCouponCode }),
      })
      const data = await response.json()
      if (!response.ok) {
        if (data?.code === 'PROFILE_REQUIRED') {
          router.push('/company/onboarding')
          return
        }
        throw new Error(data.error || 'Unable to start checkout')
      }
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
            Select a company advertising plan to request local mortgage originator listings.
          </p>
        </div>
        <div className="mx-auto mt-6 max-w-4xl">
          <CompanyPlanAndCoupon
            onCouponChange={(code) => setAppliedCouponCode(code)}
            onCheckout={(plan) => select(plan)}
            checkoutLoadingPlanId={loading}
          />
        </div>
        {error && <p className="mx-auto mt-6 max-w-2xl rounded bg-destructive/10 p-3 text-center text-sm text-destructive">{error}</p>}
        <p className="mt-8 text-center text-sm text-muted-foreground">
          <Link href="/company/dashboard" className="font-medium text-primary hover:underline">Skip for now</Link>
        </p>
      </div>
    </main>
  )
}