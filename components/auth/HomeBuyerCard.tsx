'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mail } from 'lucide-react'
import { GoogleContinueButton } from './GoogleContinueButton'
import { CustomerEmailSignup } from './CustomerEmailSignup'
import { AuthDivider } from './AuthDivider'
import { cn } from '@/lib/utils'

export function HomeBuyerCard() {
  const [showEmail, setShowEmail] = useState(false)

  return (
    <div className="space-y-3">
      <GoogleContinueButton callbackUrl="/" />
      <AuthDivider label="or" />
      <button
        type="button"
        onClick={() => setShowEmail((current) => !current)}
        aria-expanded={showEmail}
        aria-controls="customer-email-signup"
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
      >
        <Mail className="h-4 w-4" aria-hidden="true" />
        {showEmail ? 'Hide email signup' : 'Continue with Email'}
      </button>
      <div id="customer-email-signup" className={cn('transition-opacity', showEmail ? 'block opacity-100' : 'hidden opacity-0')}>
        <CustomerEmailSignup />
      </div>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/auth/signin" className="font-medium text-primary hover:text-primary/80">
          Sign in
        </Link>
      </p>
    </div>
  )
}
