'use client'

import { useEffect, useRef, useState } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import { Loader2 } from 'lucide-react'
import { FormInput } from '@/components/design/FormInput'
import { PremiumButton } from '@/components/design/PremiumButton'
import { GoogleContinueButton } from '@/components/auth/GoogleContinueButton'
import { AuthDivider } from '@/components/auth/AuthDivider'

export default function ClaimContinuePage() {
  const router = useRouter()
  const { update: refreshSession } = useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState<{ companyName: string | null; displayName: string } | null>(null)
  const [isGoogle, setIsGoogle] = useState(false)
  const [googleFailed, setGoogleFailed] = useState(false)
  const ranRef = useRef(false)

  useEffect(() => {
    const provider = new URLSearchParams(window.location.search).get('provider')
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (provider === 'google') setIsGoogle(true)
    if (ranRef.current) return
    ranRef.current = true

    fetch('/api/claims/session')
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.message)
        setProfile(data.profile)
        setEmail(data.email || '')
        if (provider === 'google') {
          const reauth = await fetch('/api/claims/session/reauth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: 'google' }) })
          if (!reauth.ok) throw new Error('Google reauthentication could not be completed')
        }
        const completed = await fetch('/api/claims/session/complete', { method: 'POST' })
        if (completed.ok) {
          const result = await completed.json()
          // Pass a data object to force a POST session update, persisting the
          // newly promoted BROKER role to the session cookie.
          await refreshSession({})
          toast.success('Broker profile claimed successfully.')
          router.push(result.redirectTo || '/broker/dashboard')
        }
      })
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : 'Claim session expired')
        if (provider === 'google') setGoogleFailed(true)
      })
  }, [router, refreshSession])

  async function complete(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true); setMessage('')
    try {
      const result = await signIn('credentials', { email, password, redirect: false })
      if (result?.error) { setMessage("We couldn't verify your account. Please try again."); return }
      const reauth = await fetch('/api/claims/session/reauth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) })
      if (!reauth.ok) { setMessage('Reauthentication could not be completed.'); return }
      const response = await fetch('/api/claims/session/complete', { method: 'POST' })
      const data = await response.json()
      if (!response.ok) { setMessage(data.message || 'Unable to complete claim'); return }
      await refreshSession({})
      toast.success('Broker profile claimed successfully.')
      router.push(data.redirectTo || '/broker/dashboard')
    } finally {
      setLoading(false)
    }
  }

  if (isGoogle) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md">
          {googleFailed ? (
            <div className="space-y-5 rounded-2xl border border-border bg-card p-8 text-center shadow-soft">
              <h1 className="text-xl font-semibold">Unable to complete your claim</h1>
              {message && <p className="text-sm text-muted-foreground">{message}</p>}
              <div className="space-y-2">
                <PremiumButton fullWidth onClick={() => window.location.reload()}>Try again</PremiumButton>
                <Link href="/auth/signin" className="inline-block text-sm font-medium text-primary hover:underline">Return to sign in</Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4 rounded-2xl border border-border bg-card p-8 text-center shadow-soft">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
              <div>
                <h1 className="text-lg font-semibold">Completing your broker claim…</h1>
                <p className="mt-2 text-sm text-muted-foreground">Please wait while we securely connect your account to your broker profile.</p>
              </div>
            </div>
          )}
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12 sm:px-6">
      <div className="w-full max-w-md space-y-6">
        <header className="text-center">
          <p className="text-sm font-semibold text-primary">HomeLoanMarket</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">Complete your profile claim</h1>
          {profile && <p className="mt-2 text-sm text-muted-foreground">Verify ownership of {profile.companyName || profile.displayName} with your account.</p>}
        </header>

        <form onSubmit={complete} className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-soft">
          <FormInput label="Email address" name="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" />
          <FormInput label="Password" name="password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" />
          <PremiumButton type="submit" fullWidth loading={loading} loadingText="Signing in…">Sign in and complete claim</PremiumButton>
          <AuthDivider label="or" />
          <GoogleContinueButton callbackUrl="/claim-broker/continue?provider=google" />
        </form>

        {message && <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{message}</p>}
      </div>
    </main>
  )
}
