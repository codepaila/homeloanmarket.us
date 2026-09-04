'use client'

import { useEffect, useState } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { Loader2 } from 'lucide-react'
import { FormInput } from '@/components/design/FormInput'
import { PremiumButton } from '@/components/design/PremiumButton'
import { GoogleContinueButton } from '@/components/auth/GoogleContinueButton'
import { AuthDivider } from '@/components/auth/AuthDivider'

type Preview = { profile: { displayName: string; companyName: string | null; profileSlug: string; description: string; city: string; state: string; logo: string | null }; invitationExpiresAt: string }

type Action = '' | 'start' | 'email' | 'create' | 'signin'

export default function ClaimBrokerPage({ params }: { params: Promise<{ token: string }> }) {
  const router = useRouter()
  const { update: refreshSession } = useSession()
  const [token, setToken] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [started, setStarted] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'email' | 'account' | 'verify' | 'error'>('email')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState<Action>('')

  useEffect(() => {
    params.then(({ token: value }) => {
      setToken(value)
      fetch(`/api/claims/${value}`)
        .then(async (response) => {
          const data = await response.json()
          if (!response.ok) {
            setMessage(response.status === 410
              ? 'This invitation has expired. Please contact the administrator for a new invitation.'
              : 'This invitation link is no longer valid.')
            setMode('error')
            return
          }
          setPreview(data)
        })
        .catch(() => {
          setMessage('This invitation link is no longer valid.')
          setMode('error')
        })
        .finally(() => setLoading(false))
    })
  }, [params])

  async function startClaim() {
    setAction('start'); setMessage('')
    try {
      const response = await fetch(`/api/claims/${token}/start`, { method: 'POST' })
      const data = await response.json()
      if (!response.ok) setMessage(response.status === 410 ? 'This invitation has expired. Please contact the administrator for a new invitation.' : data.message || 'This invitation link is no longer valid.')
      else setStarted(true)
    } finally {
      setAction('')
    }
  }

  async function submitEmail(event: React.FormEvent) {
    event.preventDefault()
    setAction('email'); setMessage('')
    try {
      const response = await fetch('/api/claims/session/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
      const data = await response.json()
      if (!response.ok) setMessage(response.status === 409 ? 'This email does not match the invitation. Use the invited email address.' : data.message || 'Unable to continue')
      else setMode('account')
    } finally {
      setAction('')
    }
  }

  async function createAccount(event: React.FormEvent) {
    event.preventDefault()
    setAction('create'); setMessage('')
    try {
      const response = await fetch('/api/auth/claim-setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) })
      const data = await response.json()
      if (!response.ok) setMessage(data.message || 'Unable to create account')
      else setMode('verify')
    } finally {
      setAction('')
    }
  }

  async function signInAndClaim() {
    setAction('signin'); setMessage('')
    try {
      const result = await signIn('credentials', { email, password, redirect: false })
      if (result?.error) { setMessage("We couldn't verify your account. Please try again."); return }
      const reauth = await fetch('/api/claims/session/reauth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) })
      if (!reauth.ok) { setMessage('Reauthentication could not be completed.'); return }
      const response = await fetch('/api/claims/session/complete', { method: 'POST' })
      const data = await response.json()
      if (!response.ok) { setMessage(data.message || 'Claim could not be completed'); return }
      await refreshSession()
      toast.success('Mortgage originator profile claimed successfully.')
      router.push(data.redirectTo || '/broker/dashboard')
    } finally {
      setAction('')
    }
  }

  const busy = action !== ''

  if (loading && !preview) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">Validating claim invitation…</p>
        </div>
      </main>
    )
  }

  if (mode === 'error') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md space-y-3 rounded border border-border bg-card p-8 text-center shadow-soft">
          <h1 className="text-xl font-semibold">Invitation unavailable</h1>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12 sm:px-6">
      <div className="w-full max-w-xl space-y-6">
        <header className="text-center">
          <p className="text-sm font-semibold text-primary">HomeLoanMarket</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Claim your mortgage originator profile</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">You&apos;ve been invited to claim this existing mortgage originator profile. Sign in or create an account with the invited email to continue.</p>
        </header>

        {preview && (
          <section className="rounded border border-border bg-card p-6 shadow-soft">
            <h2 className="text-lg font-semibold">{preview.profile.companyName || preview.profile.displayName}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{[preview.profile.city, preview.profile.state].filter(Boolean).join(', ') || 'United States'}</p>
            {preview.profile.description && <p className="mt-4 text-sm text-muted-foreground">{preview.profile.description}</p>}
            <p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">Invitation expires {new Date(preview.invitationExpiresAt).toLocaleString()}</p>
          </section>
        )}

        {!started && (
          <PremiumButton fullWidth onClick={startClaim} loading={action === 'start'} loadingText="Starting…">Start Claim</PremiumButton>
        )}

        {started && mode === 'email' && (
          <form onSubmit={submitEmail} className="space-y-4 rounded border border-border bg-card p-6 shadow-soft">
            <div>
              <h2 className="text-lg font-semibold">Verify your email</h2>
              <p className="mt-1 text-sm text-muted-foreground">Enter the email address this invitation was sent to.</p>
            </div>
            <FormInput label="Email address" name="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" />
            <PremiumButton type="submit" fullWidth loading={action === 'email'} loadingText="Continuing…">Continue</PremiumButton>
          </form>
        )}

        {started && mode === 'account' && (
          <section className="space-y-4 rounded border border-border bg-card p-6 shadow-soft">
            <div>
              <h2 className="text-lg font-semibold">Continue securely</h2>
              <p className="mt-1 text-sm text-muted-foreground">Choose how you&apos;d like to continue.</p>
            </div>

            <GoogleContinueButton callbackUrl="/claim-broker/continue?provider=google" />
            <AuthDivider label="or" />

            <form onSubmit={createAccount} className="space-y-3">
              <FormInput label="Create a password" name="password" type="password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Create a password" />
              <PremiumButton type="submit" fullWidth loading={action === 'create'} loadingText="Creating account…">Create account</PremiumButton>
            </form>

            <button type="button" onClick={signInAndClaim} disabled={busy || !password} className="inline-flex w-full items-center justify-center gap-2 rounded px-4 py-2 text-sm font-semibold text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-60">
              {action === 'signin' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {action === 'signin' ? 'Signing in…' : 'Already have an account? Sign in and claim'}
            </button>
          </section>
        )}

        {mode === 'verify' && (
          <section className="space-y-4 rounded border border-border bg-card p-6 shadow-soft">
            <div>
              <h2 className="text-lg font-semibold">Verify your email</h2>
              <p className="mt-1 text-sm text-muted-foreground">Check your email, verify the account, then return here to complete the claim.</p>
            </div>
            <PremiumButton fullWidth variant="secondary" onClick={() => router.push('/auth/verify-email')}>Open verification page</PremiumButton>
          </section>
        )}

        {message && <p role="alert" className="rounded border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{message}</p>}
      </div>
    </main>
  )
}
