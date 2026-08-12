'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AuthFormWrapper } from '@/components/design/AuthFormWrapper'
import { FormInput } from '@/components/design/FormInput'
import { PremiumButton } from '@/components/design/PremiumButton'
import { ArrowRight } from 'lucide-react'
import { toast } from 'react-hot-toast'

const types = [
  ['HOME_LOAN_COMPANY', 'Home Loan Company'],
  ['HELOC_COMPANY', 'HELOC Company'],
  ['DSCR_LOAN_COMPANY', 'DSCR Loan Company'],
  ['TITLE_COMPANY', 'Title Company'],
  ['HOME_INSURANCE_COMPANY', 'Home Insurance Company'],
  ['OTHER', 'Other'],
] as const

export default function CompanyRegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Record<string, string | boolean>>({ companyType: 'HOME_LOAN_COMPANY', agreeTerms: false })
  const set = (key: string, value: string | boolean) => setData((current) => ({ ...current, [key]: value }))
  const fields = [
    ['companyName', 'Company name'], ['address', 'Company address'], ['contactName', 'Your name'],
    ['contactPosition', 'Your position'], ['phone', 'Your phone'], ['bannerAddress', 'Company address for banner'], ['bannerPhone', 'Company phone for banner'],
    ['email', 'Email'], ['password', 'Password'],
  ]

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!data.agreeTerms) return toast.error('You must agree to the terms and conditions')
    setLoading(true)
    try {
      const response = await fetch('/api/company/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Registration failed')
      toast.success('Company account created. Please verify your email.')
      router.push(result.redirectTo)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Registration failed')
    } finally { setLoading(false) }
  }

  return (
    <AuthFormWrapper title="Join as a Company" subtitle="Create a company account to request local broker-listing advertisements." showBackLink backHref="/register" backLabel="Back to registration" size="lg" footer={<p className="text-sm text-text-muted">Already registered? <Link href="/auth/signin" className="text-primary">Sign in</Link></p>}>
      <form onSubmit={submit} className="space-y-4">
        {fields.map(([key, label]) => <FormInput key={key} label={label} name={key} type={key === 'email' ? 'email' : key === 'password' ? 'password' : 'text'} required value={String(data[key] || '')} onChange={(event) => set(key, event.target.value)} />)}
        <label className="block text-sm font-medium">Company type<select value={String(data.companyType)} onChange={(event) => set('companyType', event.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5">{types.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="flex items-start gap-3 text-sm text-text-muted"><input type="checkbox" checked={Boolean(data.agreeTerms)} onChange={(event) => set('agreeTerms', event.target.checked)} className="mt-1" />I agree to the Terms of Service and Privacy Policy.</label>
        <PremiumButton type="submit" fullWidth loading={loading} loadingText="Creating account..." leftIcon={!loading && <ArrowRight className="h-4 w-4" />}>Create Company Account</PremiumButton>
      </form>
    </AuthFormWrapper>
  )
}
