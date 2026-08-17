'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'

const fields = [
  ['displayName', 'Display name', true],
  ['companyName', 'Company name', false],
  ['nmls', 'NMLS', false],
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
  ['panNumber', 'PAN / tax number', false],
] as const

export default function AdminBrokerForm() {
  const router = useRouter()
  const [form, setForm] = useState<Record<string, string>>({ languages: 'English' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function update(name: string, value: string) {
    setForm((current) => ({ ...current, [name]: value }))
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
      </div>
      <form onSubmit={submit} className="space-y-6 rounded-xl border bg-card p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map(([name, label, required]) => (
            <label key={name} className={name === 'description' || name === 'officeAddress' ? 'sm:col-span-2 space-y-2' : 'space-y-2'}>
              <span className="text-sm font-medium">{label}{required && <span className="text-destructive"> *</span>}</span>
              {name === 'description' || name === 'officeAddress' ? (
                <textarea required={required} value={form[name] || ''} onChange={(event) => update(name, event.target.value)} className="min-h-28 w-full rounded-lg border bg-background px-3 py-2" />
              ) : (
                <input required={required} type={name === 'email' ? 'email' : name === 'experienceYears' ? 'number' : 'text'} value={form[name] || ''} onChange={(event) => update(name, event.target.value)} className="w-full rounded-lg border bg-background px-3 py-2" />
              )}
            </label>
          ))}
        </div>
        {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => router.push('/admin/brokers')} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
          <button disabled={loading} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{loading ? 'Creating...' : 'Create Unowned Broker'}</button>
        </div>
      </form>
    </div>
  )
}
