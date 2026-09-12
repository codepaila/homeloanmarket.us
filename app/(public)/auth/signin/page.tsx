'use client'

import { useActionState, useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { AuthFormWrapper } from '@/components/design/AuthFormWrapper'
import { FormInput } from '@/components/design/FormInput'
import { PremiumButton } from '@/components/design/PremiumButton'
// import { AuthDivider } from '@/components/auth/AuthDivider'
// import { GoogleContinueButton } from '@/components/auth/GoogleContinueButton'
import { sanitizeCallbackUrl } from '@/lib/auth-redirect'
import { LoginWithCredential } from '@/actions/auth.action'

function SignInContent() {
  const searchParams = useSearchParams()
  const rawCallbackUrl = searchParams.get('callbackUrl')
  const callbackBaseUrl = typeof window === 'undefined' ? undefined : window.location.origin
  const callbackUrl = sanitizeCallbackUrl(rawCallbackUrl, callbackBaseUrl) || undefined

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginState, loginAction, loginPending] = useActionState(LoginWithCredential, undefined)

  useEffect(() => {
    if (loginState?.error) toast.error(loginState.error)
  }, [loginState?.error])

  const oauthCallback = `/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl || '/')}`

  const isFormValid = !email || !password

  return (
    <AuthFormWrapper
      title="Welcome Back"
      subtitle="Sign in to your account to continue"
      showBackLink={false}
      backHref="/"
      backLabel="Back to Home"
      footer={
        <p className="text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link
            href="/auth/signup"
            className="font-medium text-primary transition-colors hover:text-primary/80"
          >
            Create account
          </Link>
        </p>
      }
    >
      <div className="space-y-6">
        {loginState?.error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive animate-fade-in motion-reduce:animate-none"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{loginState.error}</span>
          </div>
        )}

        <form action={loginAction} className="space-y-6">
          <input type="hidden" name="callbackUrl" value={rawCallbackUrl || ''} />
          <div className="space-y-4">
            <FormInput
              label="Email Address"
              name="email"
              type="email"
              placeholder="you@company.com"
              icon={<Mail className="h-4 w-4" />}
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <FormInput
              label="Password"
              name="password"
              placeholder="Enter your password"
              icon={<Lock className="h-4 w-4" />}
              required
              autoComplete="current-password"
              togglePassword
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end">
            <Link
              href="/auth/forgot-password"
              className="text-sm font-medium text-primary transition-colors hover:text-primary/80"
            >
              Forgot your password?
            </Link>
          </div>

          <PremiumButton
            type="submit"
            loading={loginPending}
            loadingText="Signing in..."
            disabled={isFormValid}
            fullWidth
            leftIcon={!loginPending && <ArrowRight className="h-4 w-4" />}
          >
            Sign In
          </PremiumButton>
        </form>

{/*
        <AuthDivider label="Or continue with" />

        <GoogleContinueButton callbackUrl={oauthCallback} />*/}
      </div>
    </AuthFormWrapper>
  )
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <AuthFormWrapper
          title="Welcome Back"
          subtitle="Sign in to your account to continue"
          showBackLink={false}
          backHref="/"
          backLabel="Back to Home"
        >
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
          </div>
        </AuthFormWrapper>
      }
    >
      <SignInContent />
    </Suspense>
  )
}
