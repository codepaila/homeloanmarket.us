/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState } from 'react'
import { motion } from 'motion/react'
import Link from 'next/link'
import { Mail, Send, CheckCircle } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { AuthFormWrapper } from '@/components/design/AuthFormWrapper'
import { FormInput } from '@/components/design/FormInput'
import { PremiumButton } from '@/components/design/PremiumButton'

const validateEmail = (email: string): string => {
  if (!email.trim()) return 'Email is required'
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) return 'Please enter a valid email address'
  return ''
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isSent, setIsSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const emailError = validateEmail(email)
    if (emailError) {
      setError(emailError)
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send reset email')
      }

      setIsSent(true)
      toast.success('Password reset instructions sent to your email')
    } catch (err: any) {
      setError(err.message || 'Unable to send reset email. Please try again.')
      toast.error(err.message || 'Unable to send reset email. Please try again.')
    } finally {
      setLoading(false)
    }
  }

    

  return (
    <AuthFormWrapper
      title="Forgot Password?"
      subtitle="Enter your email address and we'll send you a link to reset your password"
      showBackLink
      backHref="/auth/signin"
      backLabel="Back to Sign In"
      footer={
        <p className="text-sm text-muted-foreground">
          Remember your password?{' '}
          <Link
            href="/auth/signin"
            className="font-medium text-primary hover:text-primary transition-colors"
          >
            Sign in
          </Link>
        </p>
      }
    >
      {isSent ? (
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
            <h3 className="text-xl font-semibold text-foreground">Check Your Email</h3>
            <p className="text-sm text-muted-foreground">
              We&apos;ve sent password reset instructions to{' '}
              <span className="font-medium text-foreground">{email}</span>
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
              The link will expire in 1 hour. If you don&apos;t see the email, check your spam folder.
          </p>
          <button
            onClick={() => setIsSent(false)}
            className="text-sm text-primary hover:text-primary font-medium transition-colors"
          >
            Try a different email
          </button>
        </motion.div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <FormInput
              label="Email Address"
              name="email"
              type="email"
              placeholder="you@company.com"
              icon={<Mail className="h-4 w-4" />}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={error}
            />
          </div>

          <PremiumButton
            type="submit"
            loading={loading}
            loadingText="Sending..."
            fullWidth
            leftIcon={!loading && <Send className="h-4 w-4" />}
          >
            Send Reset Link
          </PremiumButton>
        </form>
      )}
    </AuthFormWrapper>
  )
}
