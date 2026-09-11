'use client'

import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { FormInput } from '@/components/design/FormInput'
import { PremiumButton } from '@/components/design/PremiumButton'
import { CompanyPlanAndCoupon, type CompanyAdvertisingPlan } from '@/components/company/CompanyPlanAndCoupon'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'

const types = [
  ['HOME_LOAN_COMPANY', 'Home Loan Company'],
  ['HELOC_COMPANY', 'HELOC Company'],
  ['DSCR_LOAN_COMPANY', 'DSCR Loan Company'],
  ['TITLE_COMPANY', 'Title Company'],
  ['HOME_INSURANCE_COMPANY', 'Home Insurance Company'],
  ['OTHER', 'Other'],
] as const

const steps = ['Company Information', 'Contact Information', 'Advertisement Information', 'Advertising Plan', 'Review & Checkout']

export function CompanyOnboarding() {
  const [step, setStep] = useState(0)
  const [phase, setPhase] = useState<'idle' | 'saving' | 'checkout'>('idle')
  const [data, setData] = useState<Record<string, string>>({ type: 'HOME_LOAN_COMPANY' })
  const [selectedPlan, setSelectedPlan] = useState<CompanyAdvertisingPlan | null>(null)
  const [appliedCouponCode, setAppliedCouponCode] = useState('')
  const [couponPreview, setCouponPreview] = useState<string | null>(null)
  const set = (key: string, value: string) => setData((current) => ({ ...current, [key]: value }))

  useEffect(() => {
    let active = true
    async function load() {
      const response = await fetch('/api/company/onboarding')
      if (!response.ok) return
      const result = await response.json()
      if (active && result.company) {
        setData((current) => ({
          ...current,
          name: result.company.name || '',
          type: result.company.type || 'HOME_LOAN_COMPANY',
          address: result.company.address || '',
          contactName: result.company.contactName || '',
          contactPosition: result.company.contactPosition || '',
          phone: result.company.phone || '',
          bannerAddress: result.company.bannerAddress || '',
          bannerPhone: result.company.bannerPhone || '',
        }))
      }
    }
    load()
    return () => { active = false }
  }, [])

  // Mandatory checkout ordering: the onboarding profile must be persisted and
  // complete BEFORE the existing Company checkout API is called (it requires a
  // complete profile). Checkout never runs when the PATCH fails.
  async function handleFinalCheckout() {
    if (!selectedPlan) {
      toast.error('Please select an advertising plan.')
      setStep(3)
      return
    }
    setPhase('saving')
    try {
      const patchResponse = await fetch('/api/company/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const patchResult = await patchResponse.json()
      if (!patchResponse.ok) throw new Error(patchResult.error || 'Unable to complete onboarding')

      setPhase('checkout')
      const checkoutResponse = await fetch('/api/company/subscription/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: selectedPlan.id, couponCode: appliedCouponCode }),
      })
      const checkoutResult = await checkoutResponse.json()
      if (!checkoutResponse.ok) {
        throw new Error(checkoutResult.error || 'Unable to start checkout')
      }
      if (typeof checkoutResult.url !== 'string' || !checkoutResult.url) {
        throw new Error('Stripe checkout is unavailable. Please try again.')
      }
      window.location.assign(checkoutResult.url)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to complete setup. Please try again.')
      setPhase('idle')
    }
  }

  const review = [
    ['Company Information', 'Complete'],
    ['Contact Information', 'Complete'],
    ['Advertisement Information', 'Complete'],
  ] as const

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-xl">
        <h1 className="text-3xl font-bold text-foreground">Complete your company profile</h1>
        <p className="mt-2 text-muted-foreground">Tell us about your company to start advertising on relevant mortgage originator listings.</p>

        <div className="mt-6 flex items-center gap-2">
          {steps.map((label, index) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${index <= step ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>{index < step ? <Check className="h-4 w-4" /> : index + 1}</div>
              <span className={`hidden text-xs ${index === step ? 'font-semibold text-foreground' : 'text-muted-foreground'} sm:inline`}>{label}</span>
              {index < steps.length - 1 && <div className="h-px w-6 bg-border" />}
            </div>
          ))}
        </div>

        <form className="mt-8 space-y-4" onSubmit={(event) => {
          event.preventDefault()
          if (step < steps.length - 1) {
            if (step === 3 && !selectedPlan) {
              toast.error('Please select an advertising plan to continue.')
              return
            }
            setStep(step + 1)
          } else {
            handleFinalCheckout()
          }
        }}>
          {step === 0 && (
            <>
              <FormInput label="Company name" name="name" type="text" required value={data.name || ''} onChange={(e) => set('name', e.target.value)} />
              <label className="block text-sm font-medium">Company type<select value={data.type} onChange={(e) => set('type', e.target.value)} className="mt-1 w-full rounded border border-border bg-background px-3 py-2.5">{types.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            </>
          )}
          {step === 1 && (
            <>
              <FormInput label="Company address" name="address" type="text" required value={data.address || ''} onChange={(e) => set('address', e.target.value)} />
              <FormInput label="Your name" name="contactName" type="text" required value={data.contactName || ''} onChange={(e) => set('contactName', e.target.value)} />
              <FormInput label="Your position" name="contactPosition" type="text" required value={data.contactPosition || ''} onChange={(e) => set('contactPosition', e.target.value)} />
              <FormInput label="Your phone" name="phone" type="text" required value={data.phone || ''} onChange={(e) => set('phone', e.target.value)} />
            </>
          )}
          {step === 2 && (
            <>
              <FormInput label="Company address for banner" name="bannerAddress" type="text" required value={data.bannerAddress || ''} onChange={(e) => set('bannerAddress', e.target.value)} />
              <FormInput label="Company phone for banner" name="bannerPhone" type="text" required value={data.bannerPhone || ''} onChange={(e) => set('bannerPhone', e.target.value)} />
            </>
          )}
          {step === 3 && (
            <CompanyPlanAndCoupon
              selectedPlanId={selectedPlan?.id ?? null}
              onSelectPlan={(plan) => setSelectedPlan(plan)}
              onCouponChange={(code, preview) => { setAppliedCouponCode(code); setCouponPreview(preview) }}
            />
          )}
          {step === 4 && (
            <div className="space-y-4">
              <div className="space-y-2 rounded border bg-card p-5">
                {review.map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="flex items-center gap-1.5 font-medium text-success"><Check className="h-4 w-4" />{value}</span>
                  </div>
                ))}
                <div className="my-3 border-t border-border" />
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">Advertising Plan</span>
                  {selectedPlan ? (
                    <span className="font-medium">${(selectedPlan.price / 100).toFixed(2)} / {selectedPlan.billingInterval}</span>
                  ) : (
                    <span className="font-medium text-destructive">No plan selected</span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">Coupon</span>
                  <span className="font-medium">{appliedCouponCode ? `${appliedCouponCode}${couponPreview ? ` — ${couponPreview}` : ''}` : 'None'}</span>
                </div>
                <div className="my-3 border-t border-border" />
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{selectedPlan ? `$${(selectedPlan.price / 100).toFixed(2)}` : '—'}</span>
                </div>
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="font-medium">{couponPreview || '—'}</span>
                </div>
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-medium">Set at Stripe checkout</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                The final amount is determined by the server and Stripe at checkout. The values above are a preview only.
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            {step > 0 && <button type="button" onClick={() => setStep(step - 1)} className="inline-flex items-center gap-2 rounded border px-4 py-2.5 text-sm font-semibold"><ArrowLeft className="h-4 w-4" />Back</button>}
            {step < steps.length - 1
              ? <PremiumButton type="submit" fullWidth leftIcon={<ArrowRight className="h-4 w-4" />}>Continue</PremiumButton>
              : (
                <PremiumButton
                  type="submit"
                  fullWidth
                  loading={phase !== 'idle'}
                  loadingText={phase === 'saving' ? 'Saving...' : 'Preparing secure checkout...'}
                >
                  Continue to Checkout
                </PremiumButton>
              )}
          </div>
        </form>

      </div>
    </main>
  )
}