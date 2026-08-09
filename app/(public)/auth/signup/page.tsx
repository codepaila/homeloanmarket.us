/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Mail, Lock, User, Phone, Briefcase, MapPin, ShieldCheck } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { AuthFormWrapper } from '@/components/design/AuthFormWrapper'
import { FormInput, FormTextarea } from '@/components/design/FormInput'
import { PremiumButton } from '@/components/design/PremiumButton'
import { AuthSection } from '@/components/auth/AuthSection'

const validateEmail = (email: string): string => {
  if (!email.trim()) return 'Email is required'
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) return 'Please enter a valid email address'
  return ''
}

const validatePhone = (phone: string): string => {
  if (!phone.trim()) return 'Phone number is required'
  const cleanPhone = phone.replace(/\s/g, '')
  const phoneDigits = cleanPhone.replace(/\D/g, '')
  if (phoneDigits.length < 7 || phoneDigits.length > 15) return 'Please enter a valid phone number'
  return ''
}

const validateName = (name: string): string => {
  if (!name.trim()) return 'Full name is required'
  if (name.trim().length < 2) return 'Name must be at least 2 characters'
  return ''
}

const validatePassword = (password: string): string => {
  if (!password) return 'Password is required'
  if (password.length < 8) return 'Password must be at least 8 characters'
  if (!/(?=.*[A-Z])/.test(password)) return 'Password must contain at least one uppercase letter'
  if (!/(?=.*\d)/.test(password)) return 'Password must contain at least one number'
  return ''
}

const validateConfirmPassword = (password: string, confirmPassword: string): string => {
  if (!confirmPassword) return 'Please confirm your password'
  if (password !== confirmPassword) return 'Passwords do not match'
  return ''
}

const validateRequired = (value: string, label: string): string => {
  if (!value.trim()) return `${label} is required`
  return ''
}

export default function BrokerSignupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const [formData, setFormData] = useState({
    name: '',
    companyName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    description: '',
    officeAddress: '',
    city: '',
    state: '',
    pinCode: '',
    agreeTerms: false,
    agreeMarketing: false
  })

  const generateCaptcha = () => {
    const num1 = Math.floor(Math.random() * 10) + 1
    const num2 = Math.floor(Math.random() * 10) + 1
    return { question: `${num1} + ${num2}`, answer: num1 + num2 }
  }

  const [initialCaptcha] = useState(generateCaptcha)
  const [captchaQuestion, setCaptchaQuestion] = useState(initialCaptcha.question)
  const [captchaAnswer, setCaptchaAnswer] = useState<number | ''>('')
  const [expectedCaptcha, setExpectedCaptcha] = useState(initialCaptcha.answer)

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }))
    let error = ''
    switch (field) {
      case 'name':
        error = validateName(formData.name)
        break
      case 'description':
        error = validateRequired(formData.description, 'Description')
        break
      case 'officeAddress':
        error = validateRequired(formData.officeAddress, 'Office address')
        break
      case 'city':
        error = validateRequired(formData.city, 'City')
        break
      case 'state':
        error = validateRequired(formData.state, 'State')
        break
      case 'pinCode':
        error = validateRequired(formData.pinCode, 'Postal code')
        break
      case 'email':
        error = validateEmail(formData.email)
        break
      case 'phone':
        error = validatePhone(formData.phone)
        break
      case 'password':
        error = validatePassword(formData.password)
        break
      case 'confirmPassword':
        error = validateConfirmPassword(formData.password, formData.confirmPassword)
        break
    }
    setErrors(prev => ({ ...prev, [field]: error }))
  }

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}
    newErrors.name = validateName(formData.name)
    newErrors.description = validateRequired(formData.description, 'Description')
    newErrors.officeAddress = validateRequired(formData.officeAddress, 'Office address')
    newErrors.city = validateRequired(formData.city, 'City')
    newErrors.state = validateRequired(formData.state, 'State')
    newErrors.pinCode = validateRequired(formData.pinCode, 'Postal code')
    newErrors.email = validateEmail(formData.email)
    newErrors.phone = validatePhone(formData.phone)
    newErrors.password = validatePassword(formData.password)
    newErrors.confirmPassword = validateConfirmPassword(formData.password, formData.confirmPassword)

    if (captchaAnswer === '') {
      newErrors.captcha = 'Please solve the CAPTCHA'
    } else if (Number(captchaAnswer) !== expectedCaptcha) {
      newErrors.captcha = 'Incorrect answer. Please try again.'
    }

    if (!formData.agreeTerms) {
      newErrors.agreeTerms = 'You must agree to the terms and conditions'
    }

    setErrors(newErrors)
    setTouched({
      name: true, description: true, officeAddress: true, city: true,
      state: true, pinCode: true, email: true, phone: true,
      password: true, confirmPassword: true, captcha: true, agreeTerms: true
    })
    return !Object.values(newErrors).some(error => error !== '')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) {
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
           companyName: formData.companyName.trim(),
           email: formData.email.trim().toLowerCase(),
           phone: formData.phone.trim(),
           password: formData.password,
           description: formData.description.trim(),
           officeAddress: formData.officeAddress.trim(),
           city: formData.city.trim(),
           state: formData.state.trim(),
           pinCode: formData.pinCode.trim(),
           agreeTerms: formData.agreeTerms,
           agreeMarketing: formData.agreeMarketing,
          captchaAnswer: Number(captchaAnswer),
          expectedCaptcha
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Registration failed')
      }
       toast.success('Your FREE broker account was created. Please check your email for verification.')
      setTimeout(() => {
        router.push(data.data?.redirectTo || '/setup')
      }, 2000)
    } catch (error: any) {
      console.error('Registration error:', error)
      toast.error(error.message || 'Registration failed. Please try again.')
      const num1 = Math.floor(Math.random() * 10) + 1
      const num2 = Math.floor(Math.random() * 10) + 1
      setCaptchaQuestion(`${num1} + ${num2}`)
      setExpectedCaptcha(num1 + num2)
      setCaptchaAnswer('')
    } finally {
      setLoading(false)
    }
  }

  const hasError = (field: string): boolean => touched[field] && !!errors[field]

  return (
    <AuthFormWrapper
      title="Become a Mortgage Broker"
      subtitle="Create your broker profile with FREE access. No payment is required."
      showBackLink
      backHref="/"
      backLabel="Back to Home"
      size="lg"
      footer={
        <p className="text-sm text-text-muted">
          Already have an account?{' '}
          <Link
            href="/auth/signin"
            className="font-medium text-primary hover:text-primary/80"
          >
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-8">
        <AuthSection
          title="Account details"
          description="These details secure your account and are used to reach you."
        >
          <FormInput
            label="Full Name"
            name="name"
            placeholder="John Doe"
            icon={<User className="h-4 w-4" />}
            required
            autoComplete="name"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            error={hasError('name') ? errors.name : undefined}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormInput
              label="Email"
              name="email"
              type="email"
              placeholder="you@company.com"
              icon={<Mail className="h-4 w-4" />}
              required
              autoComplete="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              error={hasError('email') ? errors.email : undefined}
            />
            <FormInput
              label="Phone"
              name="phone"
              placeholder="+1 (555) 987-6540"
              icon={<Phone className="h-4 w-4" />}
              required
              autoComplete="tel"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              error={hasError('phone') ? errors.phone : undefined}
            />
          </div>
        </AuthSection>

        <AuthSection
          title="Password"
          description="Use at least 8 characters with an uppercase letter and a number."
        >
          <FormInput
            label="Password"
            name="password"
            placeholder="Enter your password"
            icon={<Lock className="h-4 w-4" />}
            required
            autoComplete="new-password"
            togglePassword
            value={formData.password}
            onChange={(e) => handleChange('password', e.target.value)}
            error={hasError('password') ? errors.password : undefined}
          />

          <FormInput
            label="Confirm Password"
            name="confirmPassword"
            placeholder="Re-enter your password"
            icon={<Lock className="h-4 w-4" />}
            required
            autoComplete="new-password"
            togglePassword
            value={formData.confirmPassword}
            onChange={(e) => handleChange('confirmPassword', e.target.value)}
            error={hasError('confirmPassword') ? errors.confirmPassword : undefined}
          />
        </AuthSection>

        <AuthSection
          title="Professional profile"
          description="Tell home buyers about your brokerage and where you operate."
        >
          <FormInput
            label="Company Name"
            name="companyName"
            placeholder="Your mortgage company"
            icon={<Briefcase className="h-4 w-4" />}
            value={formData.companyName}
            onChange={(e) => handleChange('companyName', e.target.value)}
          />

          <FormTextarea
            label="Broker Profile Description"
            name="description"
            placeholder="Tell borrowers about your experience and services"
            required
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            onBlur={() => handleBlur('description')}
            error={hasError('description') ? errors.description : undefined}
          />

          <FormInput
            label="Office Address"
            name="officeAddress"
            placeholder="123 Main Street"
            icon={<MapPin className="h-4 w-4" />}
            required
            autoComplete="street-address"
            value={formData.officeAddress}
            onChange={(e) => handleChange('officeAddress', e.target.value)}
            onBlur={() => handleBlur('officeAddress')}
            error={hasError('officeAddress') ? errors.officeAddress : undefined}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormInput
              label="City"
              name="city"
              placeholder="City"
              required
              autoComplete="address-level2"
              value={formData.city}
              onChange={(e) => handleChange('city', e.target.value)}
              onBlur={() => handleBlur('city')}
              error={hasError('city') ? errors.city : undefined}
            />
            <FormInput
              label="State"
              name="state"
              placeholder="State"
              required
              autoComplete="address-level1"
              value={formData.state}
              onChange={(e) => handleChange('state', e.target.value)}
              onBlur={() => handleBlur('state')}
              error={hasError('state') ? errors.state : undefined}
            />
          </div>

          <FormInput
            label="Postal Code"
            name="pinCode"
            placeholder="Postal code"
            required
            autoComplete="postal-code"
            value={formData.pinCode}
            onChange={(e) => handleChange('pinCode', e.target.value)}
            onBlur={() => handleBlur('pinCode')}
            error={hasError('pinCode') ? errors.pinCode : undefined}
          />
        </AuthSection>

        <AuthSection title="Security check" description="Prove you are a human to continue.">
          <p className="flex items-center gap-2 rounded-xl border border-primary/10 bg-primary/5 px-4 py-3 text-sm font-medium text-text-main">
            <ShieldCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            What is {captchaQuestion}?
          </p>
          <FormInput
            label="Answer"
            name="captcha"
            type="number"
            placeholder="Enter the answer"
            required
            inputMode="numeric"
            value={captchaAnswer === '' ? '' : String(captchaAnswer)}
            onChange={(e) => setCaptchaAnswer(e.target.value ? Number(e.target.value) : '')}
            error={hasError('captcha') ? errors.captcha : undefined}
          />
        </AuthSection>

        <AuthSection title="Legal & consent">
          <div className="space-y-3">
            <label htmlFor="agreeTerms" className="flex cursor-pointer items-start gap-3 text-sm text-text-muted">
              <input
                type="checkbox"
                id="agreeTerms"
                checked={formData.agreeTerms}
                onChange={(e) => handleChange('agreeTerms', e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-primary focus:ring-primary/40"
              />
              <span>
                I agree to the{' '}
                <Link href="/terms" className="font-medium text-primary hover:text-primary/80">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link href="/privacy" className="font-medium text-primary hover:text-primary/80">
                  Privacy Policy
                </Link>
                <span className="text-destructive"> *</span>
              </span>
            </label>
            {hasError('agreeTerms') && (
              <p className="text-xs text-destructive" role="alert">
                {errors.agreeTerms}
              </p>
            )}

            <label htmlFor="agreeMarketing" className="flex cursor-pointer items-start gap-3 text-sm text-text-muted">
              <input
                type="checkbox"
                id="agreeMarketing"
                checked={formData.agreeMarketing}
                onChange={(e) => handleChange('agreeMarketing', e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-primary focus:ring-primary/40"
              />
              <span>
                I agree to receive marketing emails about new features, promotions, and updates
              </span>
            </label>
          </div>
        </AuthSection>

        <div className="space-y-3">
          <PremiumButton
            type="submit"
            loading={loading}
            loadingText="Creating Account..."
            disabled={loading}
            fullWidth
            leftIcon={!loading && <ArrowRight className="h-4 w-4" />}
          >
            Create FREE Broker Account
          </PremiumButton>
          <p className="text-center text-xs text-text-muted">
            Email verification is required before you can sign in to your broker dashboard.
          </p>
        </div>
      </form>
    </AuthFormWrapper>
  )
}
