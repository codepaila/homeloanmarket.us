'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, ShieldCheck, Scale, Lock } from 'lucide-react'
import { AuthFormWrapper } from '@/components/design/AuthFormWrapper'
import { PremiumButton } from '@/components/design/PremiumButton'
import Link from 'next/link'

export default function BrokerRegistrationConsentPage() {
  const router = useRouter()
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreePrivacy, setAgreePrivacy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const canContinue = agreeTerms && agreePrivacy

  const handleContinue = async () => {
    if (!agreeTerms || !agreePrivacy) {
      setError('You must agree to both the Terms & Conditions and Privacy Policy.')
      return
    }
    setLoading(true)
    setError('')
    try {
      // Persist explicit legal consent server-side. Authentication alone is
      // never treated as consent; the server independently requires both
      // agreements to be true.
      const response = await fetch('/api/auth/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agreeToTerms: agreeTerms, agreeToPrivacy: agreePrivacy }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Could not record your consent.')
      }
      // Return to the continuation step, which proceeds because consent is now
      // persisted on the user's canonical record.
      router.replace('/broker-registration/continue')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to continue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthFormWrapper
      title="Broker Registration — Legal Agreement"
      subtitle="Before completing your mortgage originator account, please confirm your agreement to our terms."
      size="lg"
      showBackLink
      backHref="/auth/signup"
      backLabel="Back to signup"
    >
      <div className="space-y-6">
        <div className="rounded border bg-card/60 p-6 space-y-4">
          <h3 className="font-semibold text-foreground">Required Agreements</h3>

          <label className="flex cursor-pointer items-start gap-3 text-sm text-foreground">
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => {
                setAgreeTerms(e.target.checked)
                if (error) setError('')
              }}
              className="mt-0.5 h-5 w-5 shrink-0 rounded border-border text-primary focus:ring-primary/40"
            />
            <span>
              I agree to the{' '}
              <Link href="/terms-of-service" className="font-medium text-primary underline">Terms &amp; Conditions</Link>
              <span className="text-destructive"> *</span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 text-sm text-foreground">
            <input
              type="checkbox"
              checked={agreePrivacy}
              onChange={(e) => {
                setAgreePrivacy(e.target.checked)
                if (error) setError('')
              }}
              className="mt-0.5 h-5 w-5 shrink-0 rounded border-border text-primary focus:ring-primary/40"
            />
            <span>
              I agree to the{' '}
              <Link href="/privacy-policy" className="font-medium text-primary underline">Privacy Policy</Link>
              <span className="text-destructive"> *</span>
            </span>
          </label>

          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        </div>

        <div className="grid md:grid-cols-3 gap-4 text-center">
          <div className="rounded border bg-muted/50 p-4 space-y-2">
            <Scale className="h-6 w-6 text-primary mx-auto" />
            <h4 className="font-semibold text-sm">Terms</h4>
            <p className="text-xs text-muted-foreground">Rules governing account use</p>
          </div>
          <div className="rounded border bg-muted/50 p-4 space-y-2">
            <ShieldCheck className="h-6 w-6 text-primary mx-auto" />
            <h4 className="font-semibold text-sm">Privacy</h4>
            <p className="text-xs text-muted-foreground">How your data is protected</p>
          </div>
          <div className="rounded border bg-muted/50 p-4 space-y-2">
            <Lock className="h-6 w-6 text-primary mx-auto" />
            <h4 className="font-semibold text-sm">Secure</h4>
            <p className="text-xs text-muted-foreground">Encrypted and verified</p>
          </div>
        </div>

        <PremiumButton
          onClick={handleContinue}
          disabled={!canContinue || loading}
          loading={loading}
          fullWidth
          leftIcon={<ArrowRight className="h-4 w-4" />}
        >
          Continue to Broker Registration
        </PremiumButton>
      </div>
    </AuthFormWrapper>
  )
}
