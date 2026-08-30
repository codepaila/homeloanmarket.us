'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AuthFormWrapper } from '@/components/design/AuthFormWrapper'
import { FormInput } from '@/components/design/FormInput'
import { PremiumButton } from '@/components/design/PremiumButton'
import { GoogleContinueButton } from '@/components/auth/GoogleContinueButton'
import { AuthDivider } from '@/components/auth/AuthDivider'
import { ArrowRight } from 'lucide-react'
import { toast } from 'react-hot-toast'

export default function CompanyRegisterForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Record<string, string | boolean>>({ agreeTerms: false })
  const set = (key: string, value: string | boolean) => setData((current) => ({ ...current, [key]: value }))

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!data.agreeTerms) return toast.error('You must agree to the terms and conditions')
    if (data.confirmPassword !== data.password) return toast.error('Passwords do not match')
    setLoading(true)
    try {
      const payload = { name: data.name, email: data.email, password: data.password }
      const response = await fetch('/api/company/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Registration failed')
      toast.success('Company account created. Please verify your email.')
      router.push(result.redirectTo)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Registration failed')
    } finally { setLoading(false) }
  }

  return (
    <AuthFormWrapper showBackLink={false} title="Join as a Company" subtitle="Create your company account and get started with advertising opportunities across relevant mortgage originator listings." backHref="/register" backLabel="Back to registration" size="lg" footer={<p className="text-sm text-muted-foreground">Already registered? <Link href="/auth/signin" className="text-primary">Sign in</Link></p>}>
      <form onSubmit={submit} className="space-y-4">
        <GoogleContinueButton callbackUrl="/company/register/continue" companyIntent />
        <AuthDivider label="or register with email" />
        <FormInput label="Full name" name="name" type="text" required value={String(data.name || '')} onChange={(event) => set('name', event.target.value)} />
        <FormInput label="Email" name="email" type="email" required value={String(data.email || '')} onChange={(event) => set('email', event.target.value)} />
        <FormInput label="Password" name="password" type="password" required value={String(data.password || '')} onChange={(event) => set('password', event.target.value)} />
        <FormInput label="Confirm password" name="confirmPassword" type="password" required value={String(data.confirmPassword || '')} onChange={(event) => set('confirmPassword', event.target.value)} />
        <label className="flex items-start gap-3 text-sm text-muted-foreground"><input type="checkbox" checked={Boolean(data.agreeTerms)} onChange={(event) => set('agreeTerms', event.target.checked)} className="mt-1" />I agree to the Terms of Service and Privacy Policy.</label>
        <PremiumButton type="submit" fullWidth loading={loading} loadingText="Creating account..." leftIcon={!loading && <ArrowRight className="h-4 w-4" />}>Create Company Account</PremiumButton>
      </form>
    </AuthFormWrapper>
  )
}
