'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Mail, Lock, User, ShieldCheck } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { Loader2 } from 'lucide-react'
import { AuthFormWrapper } from '@/components/design/AuthFormWrapper'
import { FormInput } from '@/components/design/FormInput'
import { PremiumButton } from '@/components/design/PremiumButton'
import { AuthSection } from '@/components/auth/AuthSection'
import { GoogleContinueButton } from '@/components/auth/GoogleContinueButton'
import { AuthDivider } from '@/components/auth/AuthDivider'

const VALID_PLAN_CODES = ['FREE', 'FEATURED'] as const

const validateEmail = (email: string) => {
  if (!email.trim()) return 'Email is required'
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? '' : 'Please enter a valid email address'
}

const validateName = (name: string) => {
  if (!name.trim()) return 'Full name is required'
  return name.trim().length >= 2 ? '' : 'Name must be at least 2 characters'
}

const validatePassword = (password: string) => {
  if (!password) return 'Password is required'
  if (password.length < 8) return 'Password must be at least 8 characters'
  if (!/(?=.*[A-Z])/.test(password)) return 'Password must contain at least one uppercase letter'
  if (!/(?=.*\d)/.test(password)) return 'Password must contain at least one number'
  return ''
}

function generateCaptcha() {
  const first = Math.floor(Math.random() * 10) + 1
  const second = Math.floor(Math.random() * 10) + 1
  return { question: `${first} + ${second}`, answer: first + second }
}

function BrokerSignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedPlan = searchParams.get('plan')
  const validPlan = selectedPlan && (VALID_PLAN_CODES as readonly string[]).includes(selectedPlan)
    ? selectedPlan
    : null

  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false,
    agreeToPrivacy: false,
  })
  // Hydration-safe CAPTCHA: start with a deterministic placeholder that matches
  // between server and client, then generate the real CAPTCHA after hydration.
  const [captcha, setCaptcha] = useState({ question: '7 + 6', answer: 13 })
  const [captchaAnswer, setCaptchaAnswer] = useState<number | ''>('')
  const [hydrated, setHydrated] = useState(false)

  // Generate a random CAPTCHA after hydration to avoid SSR/client mismatch.
  useEffect(() => {
    setCaptcha(generateCaptcha())
    setHydrated(true)
  }, [])

  const update = (field: string, value: string | boolean | number) => {
    setFormData((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: '' }))
  }

  const validate = () => {
    const next: Record<string, string> = {
      name: validateName(formData.name),
      email: validateEmail(formData.email),
      password: validatePassword(formData.password),
      confirmPassword: formData.password === formData.confirmPassword ? '' : 'Passwords do not match',
      captcha: Number(captchaAnswer) === captcha.answer ? '' : 'Incorrect CAPTCHA answer',
      agreeToTerms: formData.agreeToTerms ? '' : 'You must agree to the Terms & Conditions',
      agreeToPrivacy: formData.agreeToPrivacy ? '' : 'You must agree to the Privacy Policy',
    }
    setErrors(next)
    setTouched(Object.fromEntries(Object.keys(next).map((key) => [key, true])))
    return !Object.values(next).some(Boolean)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!validate()) {
      toast.error('Please correct the highlighted fields.')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/auth/register/broker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          agreeToTerms: formData.agreeToTerms,
          agreeToPrivacy: formData.agreeToPrivacy,
          captchaAnswer: Number(captchaAnswer),
          expectedCaptcha: captcha.answer,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Registration failed')
      toast.success('Account created. Please verify your email to continue.')
      let redirectTo = data.data?.redirectTo || '/auth/verify-email'
      if (validPlan) {
        const separator = redirectTo.includes('?') ? '&' : '?'
        redirectTo += `${separator}plan=${validPlan}`
      }
      router.push(redirectTo)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const hasError = (field: string) => touched[field] && Boolean(errors[field])

  return (
    <AuthFormWrapper
      title="Create your mortgage originator account"
      subtitle="Start with your account details. You will choose a plan and complete your mortgage originator profile next."
      showBackLink={false}
      backHref="/register"
      backLabel="Back to registration"
      size="lg"
      footer={
        <p className="text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/auth/signin" className="font-medium text-primary hover:text-primary/80">Sign in</Link>
        </p>
      }
    >
      {/* <GoogleContinueButton callbackUrl="/broker-registration/continue" brokerIntent plan={validPlan} />
      <AuthDivider label="or" className='my-2 text-lg' /> */}
  
      <form onSubmit={handleSubmit} className="space-y-6">
        <AuthSection title="Account details" description="These are the only profile details required to create your mortgage originator account.">
          <FormInput
            label="Full Name"
            name="name"
            placeholder="John Doe"
            icon={<User className="h-4 w-4" />}
            required
            autoComplete="name"
            value={formData.name}
            onChange={(event) => update('name', event.target.value)}
            error={hasError('name') ? errors.name : undefined}
          />
          <FormInput
            label="Email"
            name="email"
            type="email"
            placeholder="you@company.com"
            icon={<Mail className="h-4 w-4" />}
            required
            autoComplete="email"
            value={formData.email}
            onChange={(event) => update('email', event.target.value)}
            error={hasError('email') ? errors.email : undefined}
          />
        </AuthSection>

        <AuthSection title="Password" description="Use at least 8 characters with an uppercase letter and a number.">
          <FormInput
            label="Password"
            name="password"
            type="password"
            placeholder="Enter your password"
            icon={<Lock className="h-4 w-4" />}
            required
            autoComplete="new-password"
            togglePassword
            value={formData.password}
            onChange={(event) => update('password', event.target.value)}
            error={hasError('password') ? errors.password : undefined}
          />
          <FormInput
            label="Confirm Password"
            name="confirmPassword"
            type="password"
            placeholder="Re-enter your password"
            icon={<Lock className="h-4 w-4" />}
            required
            autoComplete="new-password"
            togglePassword
            value={formData.confirmPassword}
            onChange={(event) => update('confirmPassword', event.target.value)}
            error={hasError('confirmPassword') ? errors.confirmPassword : undefined}
          />
        </AuthSection>

        <AuthSection title="Security and terms">
          <p className="flex items-center gap-2 rounded border border-primary/10 bg-primary/5 px-4 py-3 text-sm font-medium text-foreground">
            <ShieldCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            What is {captcha.question}?
          </p>
          <FormInput
            label="Answer"
            name="captcha"
            type="number"
            placeholder="Enter the answer"
            required
            inputMode="numeric"
            value={captchaAnswer === '' ? '' : String(captchaAnswer)}
            onChange={(event) => setCaptchaAnswer(event.target.value ? Number(event.target.value) : '')}
            error={hasError('captcha') ? errors.captcha : undefined}
          />
          <label htmlFor="agreeToTerms" className="flex cursor-pointer items-start gap-3 text-sm text-muted-foreground">
            <input
              type="checkbox"
              id="agreeToTerms"
              checked={formData.agreeToTerms}
              onChange={(event) => update('agreeToTerms', event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-primary focus:ring-primary/40"
            />
            <span>
              I agree to the <Link href="/terms-of-service" className="font-medium text-primary">Terms &amp; Conditions</Link>
              <span className="text-destructive"> *</span>
            </span>
          </label>
          <label htmlFor="agreeToPrivacy" className="flex cursor-pointer items-start gap-3 text-sm text-muted-foreground">
            <input
              type="checkbox"
              id="agreeToPrivacy"
              checked={formData.agreeToPrivacy}
              onChange={(event) => update('agreeToPrivacy', event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-primary focus:ring-primary/40"
            />
            <span>
              I agree to the <Link href="/privacy-policy" className="font-medium text-primary">Privacy Policy</Link>
              <span className="text-destructive"> *</span>
            </span>
          </label>
          {hasError('agreeToTerms') && <p className="text-xs text-destructive" role="alert">{errors.agreeToTerms}</p>}
          {hasError('agreeToPrivacy') && <p className="text-xs text-destructive" role="alert">{errors.agreeToPrivacy}</p>}
        </AuthSection>

        <div className="space-y-3">
          <PremiumButton type="submit" loading={loading} loadingText="Creating Account..." disabled={loading} fullWidth leftIcon={!loading && <ArrowRight className="h-4 w-4" />}>
            Create Mortgage Originator Account
          </PremiumButton>
          <p className="text-center text-xs text-muted-foreground">Email verification is required before continuing.</p>
        </div>
      </form>
    </AuthFormWrapper>
  )
}

export default function BrokerSignupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <BrokerSignupForm />
    </Suspense>
  )
}
