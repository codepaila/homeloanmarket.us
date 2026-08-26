'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Mail, Lock, User, ShieldCheck } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { AuthFormWrapper } from '@/components/design/AuthFormWrapper'
import { FormInput } from '@/components/design/FormInput'
import { PremiumButton } from '@/components/design/PremiumButton'
import { AuthSection } from '@/components/auth/AuthSection'

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

export default function BrokerSignupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeTerms: false,
  })
  const [captcha] = useState(() => {
    const first = Math.floor(Math.random() * 10) + 1
    const second = Math.floor(Math.random() * 10) + 1
    return { question: `${first} + ${second}`, answer: first + second }
  })
  const [captchaAnswer, setCaptchaAnswer] = useState<number | ''>('')

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
      agreeTerms: formData.agreeTerms ? '' : 'You must agree to the terms and conditions',
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
          agreeTerms: formData.agreeTerms,
          captchaAnswer: Number(captchaAnswer),
          expectedCaptcha: captcha.answer,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Registration failed')
      toast.success('Account created. Please verify your email to continue.')
      router.push(data.data?.redirectTo || '/auth/verify-email')
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
        <p className="text-sm text-text-muted">
          Already have an account?{' '}
          <Link href="/auth/signin" className="font-medium text-primary hover:text-primary/80">Sign in</Link>
        </p>
      }
    >
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
          <p className="flex items-center gap-2 rounded-xl border border-primary/10 bg-primary/5 px-4 py-3 text-sm font-medium text-text-main">
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
          <label htmlFor="agreeTerms" className="flex cursor-pointer items-start gap-3 text-sm text-text-muted">
            <input
              type="checkbox"
              id="agreeTerms"
              checked={formData.agreeTerms}
              onChange={(event) => update('agreeTerms', event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-primary focus:ring-primary/40"
            />
            <span>
              I agree to the <Link href="/terms" className="font-medium text-primary">Terms of Service</Link> and{' '}
              <Link href="/privacy" className="font-medium text-primary">Privacy Policy</Link>.
              <span className="text-destructive"> *</span>
            </span>
          </label>
          {hasError('agreeTerms') && <p className="text-xs text-destructive" role="alert">{errors.agreeTerms}</p>}
        </AuthSection>

        <div className="space-y-3">
          <PremiumButton type="submit" loading={loading} loadingText="Creating Account..." disabled={loading} fullWidth leftIcon={!loading && <ArrowRight className="h-4 w-4" />}>
            Create Mortgage Originator Account
          </PremiumButton>
          <p className="text-center text-xs text-text-muted">Email verification is required before continuing.</p>
        </div>
      </form>
    </AuthFormWrapper>
  )
}
