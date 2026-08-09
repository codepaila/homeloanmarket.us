'use client'

import { useEffect, useState } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function ClaimContinuePage() {
  const router = useRouter()
  const { update: refreshSession } = useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [profile, setProfile] = useState<{ companyName: string | null; displayName: string } | null>(null)
  useEffect(() => { const provider = new URLSearchParams(window.location.search).get('provider'); fetch('/api/claims/session').then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.message); setProfile(data.profile); setEmail(data.email || ''); if (provider === 'google') { const reauth = await fetch('/api/claims/session/reauth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: 'google' }) }); if (!reauth.ok) throw new Error('Google reauthentication could not be completed') } const completed = await fetch('/api/claims/session/complete', { method: 'POST' }); if (completed.ok) { const result = await completed.json(); await refreshSession(); router.push(result.redirectTo || '/broker/dashboard') } }).catch((error) => setMessage(error.message || 'Claim session expired')) }, [router, refreshSession])
  async function complete(event: React.FormEvent) { event.preventDefault(); setMessage(''); const result = await signIn('credentials', { email, password, redirect: false }); if (result?.error) { setMessage('Unable to authenticate.'); return } const reauth = await fetch('/api/claims/session/reauth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) }); if (!reauth.ok) { setMessage('Reauthentication could not be completed.'); return } const response = await fetch('/api/claims/session/complete', { method: 'POST' }); const data = await response.json(); if (!response.ok) setMessage(data.message || 'Unable to complete claim'); else { await refreshSession(); router.push(data.redirectTo || '/broker/dashboard') } }
  async function google() { await signIn('google', { callbackUrl: '/claim-broker/continue?provider=google' }) }
  return <main className="mx-auto max-w-xl space-y-6 p-8"><h1 className="text-3xl font-semibold">Complete your profile claim</h1>{profile && <p className="text-muted-foreground">Verify ownership of {profile.companyName || profile.displayName} with your account.</p>}<form onSubmit={complete} className="space-y-3 rounded-xl border bg-card p-5"><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" className="w-full rounded-lg border bg-background px-3 py-2" /><input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" className="w-full rounded-lg border bg-background px-3 py-2" /><button className="rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground">Sign in and complete claim</button><button type="button" onClick={google} className="rounded-lg border px-4 py-2 text-sm">Continue with Google</button></form>{message && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{message}</p>}</main>
}
