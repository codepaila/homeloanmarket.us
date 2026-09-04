'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { US_STATES } from '@/lib/us-states'

const fields = [
  ['displayName', 'Display name', true],
  ['companyName', 'Company name', false],
  ['nmls', 'NMLS ID', false],
  ['description', 'Description', true],
  ['phone', 'Phone', true],
  ['email', 'Profile email', false],
  ['website', 'Website', false],
  ['officeAddress', 'Office address', true],
  ['city', 'City', true],
  ['state', 'State', true],
  ['pinCode', 'Postal code', true],
  ['experienceYears', 'Experience years', false],
  ['registrationNumber', 'Registration number', false],
  ['panNumber', 'Tax ID / EIN', false],
] as const

export default function AdminBrokerForm() {
  const router = useRouter()
  const [form, setForm] = useState<Record<string, string>>({ languages: 'English' })
  const [licenseStates, setLicenseStates] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function update(name: string, value: string) {
    setForm((current) => ({ ...current, [name]: value }))
  }

  function toggleState(code: string) {
    setLicenseStates((current) => current.includes(code) ? current.filter((c) => c !== code) : [...current, code])
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/admin/brokers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          experienceYears: Number(form.experienceYears || 0),
          licenseStates,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to create broker')
      toast.success('Broker created successfully.')
      router.push(`/admin/brokers/${data.broker.id}`)
      router.refresh()
    } catch (submissionError) {
      const message = submissionError instanceof Error ? submissionError.message : 'Unable to create broker'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Broker Management</p>
        <h1 className="text-3xl font-semibold tracking-tight">Create Admin Broker Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">The profile will be unowned, verified, published, and FREE. No User account is created.</p>
        <p className="mt-2 inline-flex items-center gap-2 rounded border border-primary/30 bg-primary/5 px-3 py-1.5 text-sm font-medium text-primary">
          Default Subscription: FREE
          <span className="text-xs text-muted-foreground">Admin-created brokers automatically receive the active FREE plan.</span>
        </p>
      </div>
      <form onSubmit={submit} className="space-y-6 rounded border bg-card p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map(([name, label, required]) => (
            <label key={name} className={name === 'description' || name === 'officeAddress' ? 'sm:col-span-2 space-y-2' : 'space-y-2'}>
              <span className="text-sm font-medium">{label}{required && <span className="text-destructive"> *</span>}</span>
              {name === 'description' || name === 'officeAddress' ? (
                <textarea required={required} value={form[name] || ''} onChange={(event) => update(name, event.target.value)} className="min-h-28 w-full rounded border bg-background px-3 py-2" />
              ) : (
                <input required={required} type={name === 'email' ? 'email' : name === 'experienceYears' ? 'number' : 'text'} value={form[name] || ''} onChange={(event) => update(name, event.target.value)} className="w-full rounded border bg-background px-3 py-2" />
              )}
            </label>
          ))}
        </div>
        <div className="space-y-3 rounded border bg-muted/20 p-4">
          <div>
            <p className="text-sm font-medium">License States</p>
            <p className="text-sm text-muted-foreground">US states where this broker is licensed to originate mortgages. At least one is required.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {US_STATES.map((state) => {
              const selected = licenseStates.includes(state.code)
              return (
                <button
                  key={state.code}
                  type="button"
                  onClick={() => toggleState(state.code)}
                  aria-pressed={selected}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${selected ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:border-primary/40'}`}
                >
                  {state.code}
                </button>
              )
            })}
          </div>
        </div>
        {error && <p className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => router.push('/admin/brokers')} className="rounded border px-4 py-2 text-sm">Cancel</button>
          <button disabled={loading} className="rounded bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{loading ? 'Creating...' : 'Create Unowned Broker'}</button>
        </div>
      </form>
    </div>
  )
}
