'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { Loader2 } from 'lucide-react'
import { FormInput } from '@/components/design/FormInput'
import { PremiumButton } from '@/components/design/PremiumButton'

export default function ClaimContinuePage() {
  const router = useRouter()
  const { status, update: refreshSession } = useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [autoFailed, setAutoFailed] = useState(false)
  const [profile, setProfile] = useState<{ companyName: string | null; displayName: string } | null>(null)
  const loadedRef = useRef(false)
  const finalizedRef = useRef(false)

  useEffect(() => {
    // Password-only claim flow. Load the signed claim session context to prefill
    // the invited email. Google/OAuth is intentionally NOT offered here.
    if (loadedRef.current) return
    loadedRef.current = true

    fetch('/api/claims/session')
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.message)
        setProfile(data.profile)
        setEmail(data.email || '')
      })
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : 'Claim session expired')
      })
  }, [])

  const finalizeClaim = useCallback(async () => {
    const response = await fetch('/api/claims/session/complete', { method: 'POST' })
    const data = await response.json()
    if (!response.ok) {
      setMessage(data.message || 'Unable to complete claim')
      return
    }
    await refreshSession()
    toast.success('Mortgage originator profile claimed successfully.')
    router.push(data.redirectTo || '/broker/subscription/plan')
  }, [refreshSession, router])

  // New-claimant path: email verification already established the authenticated
  // session (using the single-use verification token), so complete the claim
  // against that session. The password is never requested again.
  useEffect(() => {
    if (status !== 'authenticated' || finalizedRef.current) return
    finalizedRef.current = true
    setLoading(true)
    void finalizeClaim()
      .catch(() => {
        setAutoFailed(true)
        setMessage('We could not complete your claim. Please sign in to continue.')
      })
      .finally(() => setLoading(false))
  }, [status, finalizeClaim])

  // Fallback for existing accounts / expired sessions: authenticate with the
  // password once, then complete. Kept as the safe recovery path.
  async function complete(event: React.FormEvent) {
    event.preventDefault()
    finalizedRef.current = true
    setLoading(true); setMessage('')
    try {
      const result = await signIn('credentials', { email, password, redirect: false })
      if (result?.error) { setMessage("We couldn't verify your account. Please try again."); return }
      const reauth = await fetch('/api/claims/session/reauth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) })
      if (!reauth.ok) { setMessage('Reauthentication could not be completed.'); return }
      await finalizeClaim()
    } finally {
      setLoading(false)
    }
  }

  const completing = status === 'authenticated' && !autoFailed

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12 sm:px-6">
      <div className="w-full max-w-md space-y-6">
        <header className="text-center">
          <p className="text-sm font-semibold text-primary">HomeLoanMarket</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">Complete your profile claim</h1>
          {profile && <p className="mt-2 text-sm text-muted-foreground">Verify ownership of {profile.companyName || profile.displayName} with your account.</p>}
        </header>

        {completing ? (
          <section className="space-y-3 rounded border border-border bg-card p-6 text-center shadow-soft">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">Completing your claim…</p>
          </section>
        ) : (
          <form onSubmit={complete} className="space-y-4 rounded border border-border bg-card p-6 shadow-soft">
            <FormInput label="Email address" name="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" />
            <FormInput label="Password" name="password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" />
            <PremiumButton type="submit" fullWidth loading={loading} loadingText="Signing in…">Sign in and complete claim</PremiumButton>
          </form>
        )}

        {message && <p role="alert" className="rounded border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{message}</p>}
      </div>
    </main>
  )
}
