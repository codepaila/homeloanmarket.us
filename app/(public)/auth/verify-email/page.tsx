/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
'use client'

import { useState, useEffect, Suspense, useCallback } from 'react'
import { motion } from 'motion/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Mail, CheckCircle, XCircle } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { AuthFormWrapper } from '@/components/design/AuthFormWrapper'
import { FormInput } from '@/components/design/FormInput'
import { PremiumButton } from '@/components/design/PremiumButton'

function VerifyEmailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'success' | 'error'>('pending')
  const [countdown, setCountdown] = useState(0)

  const handleVerifyToken = useCallback(async (token: string, email?: string) => {
    setLoading(true)
    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email }),
      })

      const data = await response.json()

      if (data.success) {
        setVerificationStatus('success')
        toast.success('Email verified successfully!')
        router.push(data.data?.redirectTo || '/')
      } else {
        setVerificationStatus('error')
        toast.error(data.error || 'Verification failed')
      }
    } catch {
      setVerificationStatus('error')
      toast.error('Verification failed')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    const emailParam = searchParams.get('email')
    const token = searchParams.get('token')

    if (emailParam) {
      setEmail(decodeURIComponent(emailParam))
    }

    if (token && emailParam) {
      handleVerifyToken(token, decodeURIComponent(emailParam))
    }
  }, [searchParams, handleVerifyToken])

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  const handleResendVerification = async () => {
    if (countdown > 0 || !email) return

    setResendLoading(true)
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Verification email sent. Please check your inbox and spam folder.')
        setCountdown(60)
      } else if (response.status === 429 || data.errorCode === 'RATE_LIMITED') {
        toast.error('Please wait before requesting another verification email.')
      } else if (data.errorCode === 'EMAIL_SEND_FAILED') {
        toast.error("We couldn't send the verification email right now. Please try again later.")
      } else {
        toast.error(data.error || 'Failed to resend verification email')
      }
    } catch {
      toast.error('Failed to resend verification email')
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <>
      {verificationStatus === 'success' ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="text-center space-y-6"
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-success/10 mx-auto">
            <CheckCircle className="h-10 w-10 text-success" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-text-main">Email Verified!</h3>
            <p className="text-sm text-text-muted">
              Your email has been verified successfully. Redirecting to plan selection...
            </p>
          </div>
        </motion.div>
      ) : verificationStatus === 'error' && !email ? (
        <>
          <div className="space-y-4">
            <div className="text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 mx-auto mb-4">
                <XCircle className="h-10 w-10 text-destructive" />
              </div>
              <h3 className="text-xl font-semibold text-text-main">Verification Failed</h3>
              <p className="text-sm text-text-muted">
                The verification link is invalid or expired.
              </p>
            </div>

            <FormInput
              label="Email Address"
              name="email"
              type="email"
              placeholder="you@company.com"
              icon={<Mail className="h-4 w-4" />}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <PremiumButton
            onClick={handleResendVerification}
            loading={resendLoading}
            loadingText="Sending..."
            disabled={resendLoading || countdown > 0 || !email}
            fullWidth
            leftIcon={!resendLoading && <Mail className="h-4 w-4" />}
          >
            {countdown > 0 ? `Resend in ${countdown}s` : 'Send Verification Email'}
          </PremiumButton>
        </>
      ) : (
        <>
          <div className="space-y-4">
            <div className="text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-info/10 mx-auto mb-4">
                <Mail className="h-10 w-10 text-info" />
              </div>
              <h3 className="text-xl font-semibold text-text-main">Verify Your Email</h3>
              <p className="text-sm text-text-muted">
                {email ? `We sent a verification link to ${email}` : 'Check your email for the verification link'}
              </p>
            </div>

            {!email && (
              <FormInput
                label="Email Address"
                name="email"
                type="email"
                placeholder="you@company.com"
                icon={<Mail className="h-4 w-4" />}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
          </div>

          <div className="space-y-3">
            <PremiumButton
              onClick={handleResendVerification}
              loading={resendLoading || loading}
              loadingText="Sending..."
              disabled={resendLoading || countdown > 0 || !email}
              fullWidth
              leftIcon={!loading && !resendLoading && <Mail className="h-4 w-4" />}
            >
              {countdown > 0 ? `Resend in ${countdown}s` : 'Resend Verification Email'}
            </PremiumButton>

            <div className="text-center">
              <p className="text-xs text-text-muted mb-2">
                Didn&apos;t receive the email? Check your spam folder.
              </p>
              <Link
                href="/auth/signin"
                className="text-sm font-medium text-primary hover:text-primary transition-colors"
              >
                Back to Sign In
              </Link>
            </div>
          </div>
        </>
      )}
    </>
  )
}

export default function VerifyEmailPage() {
  return (
    <AuthFormWrapper
      title="Verify Your Email"
      subtitle="Secure your account with one click"
    >
      <Suspense
        fallback={
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto mb-4"></div>
            <p className="text-text-muted">Verifying your email...</p>
          </div>
        }
      >
        <VerifyEmailContent />
      </Suspense>
    </AuthFormWrapper>
  )
}
