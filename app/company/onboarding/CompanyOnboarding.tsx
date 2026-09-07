'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import { FormInput } from '@/components/design/FormInput'
import { PremiumButton } from '@/components/design/PremiumButton'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'

const types = [
  ['HOME_LOAN_COMPANY', 'Home Loan Company'],
  ['HELOC_COMPANY', 'HELOC Company'],
  ['DSCR_LOAN_COMPANY', 'DSCR Loan Company'],
  ['TITLE_COMPANY', 'Title Company'],
  ['HOME_INSURANCE_COMPANY', 'Home Insurance Company'],
  ['OTHER', 'Other'],
] as const

const steps = ['Company Information', 'Contact Information', 'Advertisement Information', 'Review']

export function CompanyOnboarding() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Record<string, string>>({ type: 'HOME_LOAN_COMPANY' })
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

  async function submit() {
    setLoading(true)
    try {
      const response = await fetch('/api/company/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to complete onboarding')
      toast.success('Company onboarding completed.')
      router.push('/company/dashboard')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to complete onboarding. Please try again.')
      setLoading(false)
    }
  }

  const review = [
    ['Company name', data.name],
    ['Company type', types.find(([value]) => value === data.type)?.[1] || data.type],
    ['Company address', data.address],
    ['Your name', data.contactName],
    ['Your position', data.contactPosition],
    ['Your phone', data.phone],
    ['Banner address', data.bannerAddress],
    ['Banner phone', data.bannerPhone],
  ]

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

        <form className="mt-8 space-y-4" onSubmit={(event) => { event.preventDefault(); if (step < steps.length - 1) setStep(step + 1); else submit() }}>
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
            <div className="space-y-2 rounded border bg-card p-5">
              {review.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="text-right font-medium">{value}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            {step > 0 && <button type="button" onClick={() => setStep(step - 1)} className="inline-flex items-center gap-2 rounded border px-4 py-2.5 text-sm font-semibold"><ArrowLeft className="h-4 w-4" />Back</button>}
            {step < steps.length - 1
              ? <PremiumButton type="submit" fullWidth leftIcon={<ArrowRight className="h-4 w-4" />}>Continue</PremiumButton>
              : <PremiumButton type="submit" fullWidth loading={loading} loadingText="Completing setup...">Complete Company Setup</PremiumButton>}
          </div>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/company/dashboard" className="font-medium text-primary hover:underline">Skip for now</Link>
        </p>
      </div>
    </main>
  )
}