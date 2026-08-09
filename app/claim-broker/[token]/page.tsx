'use client'

import { useEffect, useState } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

type Preview = { profile: { displayName: string; companyName: string | null; profileSlug: string; description: string; city: string; state: string; logo: string | null }; invitationExpiresAt: string }

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

  useEffect(() => { params.then(({ token: value }) => { setToken(value); fetch(`/api/claims/${value}`).then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.message); setPreview(data) }).catch((error) => { setMessage(error.message || 'This invitation is not available.'); setMode('error') }).finally(() => setLoading(false)) }) }, [params])

  async function startClaim() {
    setLoading(true); setMessage('')
    const response = await fetch(`/api/claims/${token}/start`, { method: 'POST' })
    const data = await response.json()
    if (!response.ok) setMessage(data.message || 'Unable to start claim')
    else setStarted(true)
    setLoading(false)
  }

  async function submitEmail(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true); setMessage('')
    const response = await fetch('/api/claims/session/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
    const data = await response.json()
    if (!response.ok) setMessage(data.message || 'Unable to continue')
    else setMode('account')
    setLoading(false)
  }

  async function createAccount(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setMessage('')
    const response = await fetch('/api/auth/claim-setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) })
    const data = await response.json()
    if (!response.ok) setMessage(data.message || 'Use the existing account sign-in option to continue')
    else setMode('verify')
    setLoading(false)
  }

  async function signInAndComplete() {
    setLoading(true); setMessage('')
    const result = await signIn('credentials', { email, password, redirect: false })
    if (result?.error) { setMessage('Unable to authenticate this account. Verify your email or use the appropriate account provider.'); setLoading(false); return }
    const reauth = await fetch('/api/claims/session/reauth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) })
    if (!reauth.ok) { setMessage('Reauthentication could not be completed.'); setLoading(false); return }
    const response = await fetch('/api/claims/session/complete', { method: 'POST' })
    const data = await response.json()
    if (!response.ok) setMessage(data.message || 'Claim could not be completed')
    else { await refreshSession(); router.push(data.redirectTo || '/broker/dashboard') }
    setLoading(false)
  }

  async function continueWithGoogle() { await signIn('google', { callbackUrl: '/claim-broker/continue?provider=google' }) }

  if (loading && !preview) return <main className="mx-auto max-w-2xl p-8"><p>Validating claim invitation...</p></main>
  if (mode === 'error') return <main className="mx-auto max-w-2xl space-y-4 p-8"><h1 className="text-2xl font-semibold">Invitation unavailable</h1><p>{message}</p></main>

  return <main className="mx-auto max-w-2xl space-y-6 p-8">
    <div><p className="text-sm font-medium text-muted-foreground">HomeLoanMarket</p><h1 className="text-3xl font-semibold">Claim your existing broker profile</h1><p className="mt-2 text-muted-foreground">You are claiming this existing business profile. A new Broker listing will not be created.</p></div>
    {preview && <section className="rounded-xl border bg-card p-5"><h2 className="text-xl font-semibold">{preview.profile.companyName || preview.profile.displayName}</h2><p className="mt-1 text-sm text-muted-foreground">{preview.profile.city}, {preview.profile.state}</p><p className="mt-4 text-sm">{preview.profile.description}</p><p className="mt-4 text-xs text-muted-foreground">Invitation expires {new Date(preview.invitationExpiresAt).toLocaleString()}.</p></section>}
    {!started && <button onClick={startClaim} disabled={loading} className="rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground">Start Claim</button>}
    {started && mode === 'email' && <form onSubmit={submitEmail} className="space-y-4 rounded-xl border bg-card p-5"><h2 className="text-xl font-semibold">Choose the account email</h2><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" className="w-full rounded-lg border bg-background px-3 py-2" /><button disabled={loading} className="rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground">Continue</button></form>}
    {started && mode === 'account' && <section className="space-y-4 rounded-xl border bg-card p-5"><h2 className="text-xl font-semibold">Continue securely</h2><p className="text-sm text-muted-foreground">Use an existing account or create a new password-based account. Your email will be verified before ownership is attached.</p><form onSubmit={createAccount} className="space-y-3"><input type="password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Create a password" className="w-full rounded-lg border bg-background px-3 py-2" /><button disabled={loading} className="rounded-lg border px-4 py-2 text-sm">Create new account</button></form><div className="flex flex-wrap gap-3"><button type="button" onClick={signInAndComplete} disabled={loading || !password} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Sign in and claim</button><button type="button" onClick={continueWithGoogle} className="rounded-lg border px-4 py-2 text-sm">Continue with Google</button></div></section>}
    {mode === 'verify' && <section className="rounded-xl border bg-card p-5"><h2 className="text-xl font-semibold">Verify your email</h2><p className="mt-2 text-sm text-muted-foreground">Check your email, verify the account, then return here to complete the claim.</p><button onClick={() => router.push('/auth/verify-email')} className="mt-4 rounded-lg border px-4 py-2 text-sm">Open verification page</button></section>}
    {message && <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{message}</p>}
  </main>
}
