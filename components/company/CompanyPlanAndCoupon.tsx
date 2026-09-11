'use client'

import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'

export type CompanyAdvertisingPlan = {
  id: string
  name: string
  description: string | null
  price: number
  billingInterval: string
  features: string[]
}

type CompanyPlanAndCouponProps = {
  /** Controlled selected plan id (wizard mode). Cards are selectable but do not
   *  start checkout on their own. */
  selectedPlanId?: string | null
  onSelectPlan?: (plan: CompanyAdvertisingPlan) => void
  /** Reports the human-entered applied coupon code and a display-only discount
   *  preview. The server remains authoritative for validity and the final amount. */
  onCouponChange?: (appliedCode: string, preview: string | null) => void
  /** Per-plan immediate checkout (subscription-select page mode). When provided,
   *  each plan card renders its own action button. */
  onCheckout?: (plan: CompanyAdvertisingPlan, couponCode: string) => void
  /** Plan id currently starting checkout (disables that card's button). */
  checkoutLoadingPlanId?: string | null
}

// Shared plan-selection + optional-coupon UI used by both the Company onboarding
// wizard (Step 4) and the /company/subscription/select page. Reuses the existing
// canonical Company plan API and coupon validation API — no duplicated backend
// logic. The browser only holds display values; Stripe remains the authority.
export function CompanyPlanAndCoupon({
  selectedPlanId = null,
  onSelectPlan,
  onCouponChange,
  onCheckout,
  checkoutLoadingPlanId = null,
}: CompanyPlanAndCouponProps) {
  const [plans, setPlans] = useState<CompanyAdvertisingPlan[]>([])
  const [loadingPlans, setLoadingPlans] = useState(true)
  const [error, setError] = useState('')
  const [couponCode, setCouponCode] = useState('')
  const [couponState, setCouponState] = useState<'idle' | 'applying' | 'applied' | 'error'>('idle')
  const [couponMessage, setCouponMessage] = useState('')
  const [couponAppliedCode, setCouponAppliedCode] = useState('')
  const [couponDiscount, setCouponDiscount] = useState<string | null>(null)

  async function applyCoupon() {
    const code = couponCode.trim()
    if (!code || couponState === 'applying' || couponState === 'applied') return
    setCouponState('applying')
    setCouponMessage('')
    setCouponDiscount(null)
    try {
      const response = await fetch('/api/company/subscription/coupon/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await response.json()
      if (data.valid) {
        setCouponState('applied')
        setCouponAppliedCode(code)
        // Display-only discount preview from the server (percent or fixed
        // amount). The authoritative final price is computed by Stripe at
        // Checkout — the browser never calculates the total.
        let preview: string | null = null
        if (typeof data.percentOff === 'number' && data.percentOff > 0) {
          preview = `Save ${data.percentOff}%`
          setCouponDiscount(preview)
        } else if (typeof data.amountOff === 'number' && data.amountOff > 0) {
          const currency = typeof data.currency === 'string' ? data.currency : 'usd'
          const symbol = currency === 'usd' ? '$' : `${currency.toUpperCase()} `
          preview = `Save ${symbol}${(data.amountOff / 100).toFixed(2)}`
          setCouponDiscount(preview)
        }
        onCouponChange?.(code, preview)
        setCouponMessage(`Coupon applied.`)
      } else {
        setCouponState('error')
        setCouponMessage(data.reason || 'Invalid or unavailable coupon')
      }
    } catch {
      setCouponState('error')
      setCouponMessage('Unable to validate coupon. Please try again.')
    }
  }

  function removeCoupon() {
    setCouponState('idle')
    setCouponCode('')
    setCouponAppliedCode('')
    setCouponMessage('')
    setCouponDiscount(null)
    onCouponChange?.('', null)
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

  return (
    <div className="space-y-6">
      <div className="rounded border border-border bg-card p-4">
        <p className="mb-2 text-sm font-medium">Promo code (optional)</p>
        {couponState === 'applied' ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-700">
                Coupon applied: {couponAppliedCode}
              </span>
              {couponDiscount && (
                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-700">
                  {couponDiscount}
                </span>
              )}
            </div>
            <button type="button" onClick={removeCoupon} className="rounded border px-3 py-1 text-xs font-semibold text-muted-foreground hover:text-destructive">
              Remove
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              value={couponCode}
              onChange={(event) => { setCouponCode(event.target.value); setCouponState('idle'); setCouponMessage('') }}
              placeholder="Enter promo code"
              className="flex-1 rounded border border-border bg-background px-3 py-2.5 text-sm"
              disabled={couponState === 'applying'}
            />
            <button
              type="button"
              onClick={applyCoupon}
              disabled={couponState === 'applying' || !couponCode.trim()}
              className="rounded border px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {couponState === 'applying' ? 'Checking…' : 'Apply'}
            </button>
          </div>
        )}
        {couponMessage && (
          <p className={`mt-2 text-sm ${couponState === 'error' ? 'text-destructive' : 'text-emerald-700'}`}>{couponMessage}</p>
        )}
        {couponState === 'applied' && (
          <p className="mt-1 text-xs text-muted-foreground">The discount will be applied at Stripe checkout. The final amount is set by the server, not the browser.</p>
        )}
      </div>

      {error && <p className="rounded bg-destructive/10 p-3 text-center text-sm text-destructive">{error}</p>}
      {loadingPlans ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading advertising plan...</p>
      ) : plans.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No advertising plans are currently available.</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {plans.map((plan) => {
            const isSelected = selectedPlanId === plan.id
            const isCheckingOut = checkoutLoadingPlanId === plan.id
            return (
              <div key={plan.id} className={`flex flex-col rounded border bg-card p-6 ${isSelected ? 'border-primary ring-1 ring-primary/40' : 'border-border'}`}>
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
                {onCheckout ? (
                  <button
                    type="button"
                    disabled={isCheckingOut}
                    onClick={() => onCheckout(plan, couponAppliedCode)}
                    className="mt-auto w-full rounded bg-primary py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {isCheckingOut ? 'Starting checkout…' : 'Select plan'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelectPlan?.(plan)}
                    className="mt-auto w-full rounded border py-2.5 text-sm font-semibold disabled:opacity-60"
                  >
                    {isSelected ? 'Selected' : 'Select this plan'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}