'use client'

import { useEffect, useState } from 'react'
import { MapPin, X } from 'lucide-react'

export type SelectedUSLocation = {
  placeId?: string
  normalizedAddress: string
  city: string
  state: string
  zip: string
  latitude: number
  longitude: number
}

type ResolvedResponse = {
  location?: SelectedUSLocation & { token?: string }
}

// Strip the server-issued search token (used only by the radius search flow)
// before the location is stored in the onboarding draft or the form state. The
// persisted object must contain only the structured US address fields.
function sanitize(location: SelectedUSLocation & { token?: string }): SelectedUSLocation {
  const rest: SelectedUSLocation & { token?: string } = { ...location }
  delete rest.token
  return rest
}

export function USLocationPicker({ value, onChange }: { value?: SelectedUSLocation; onChange: (location?: SelectedUSLocation) => void }) {
  const [input, setInput] = useState(value?.normalizedAddress || '')
  const [suggestions, setSuggestions] = useState<Array<{ placeId: string; label: string }>>([])
  const [error, setError] = useState('')

  useEffect(() => {
    const query = input.trim()
    if (query.length < 2 || query === value?.normalizedAddress) {
      if (suggestions.length > 0) window.setTimeout(() => setSuggestions([]), 0)
      return
    }
    const timer = window.setTimeout(() => {
      fetch(`/api/location/autocomplete?input=${encodeURIComponent(query)}`)
        .then((response) => response.json())
        .then((data) => setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []))
        .catch(() => setSuggestions([]))
    }, 300)
    return () => window.clearTimeout(timer)
  }, [input, value?.normalizedAddress, suggestions.length])

  async function select(place: { placeId: string; label: string }) {
    setError('')
    try {
      const response = await fetch('/api/location/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeId: place.placeId }),
      })
      const data = await response.json() as ResolvedResponse
      if (!response.ok) throw new Error(data.location ? undefined : (data as { error?: string }).error || 'Unable to resolve location')
      const resolved = sanitize(data.location as SelectedUSLocation & { token?: string })
      setInput(resolved.normalizedAddress || place.label)
      setSuggestions([])
      onChange(resolved)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to resolve location')
    }
  }

  function clear() {
    setInput('')
    setSuggestions([])
    setError('')
    onChange(undefined)
  }

  return (
    <div className="relative space-y-2">
      <label className="text-sm font-medium">Office Location *</label>
      <p className="text-xs text-muted-foreground">
        Search for your business or office address and select the exact match from the suggestions.
      </p>
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          value={input}
          onChange={(event) => { setInput(event.target.value); setSuggestions([]); onChange(undefined) }}
          placeholder="Search your business or office address"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-9 text-base md:text-sm"
          autoComplete="off"
        />
      </div>
      {suggestions.length > 0 && (
        <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-md border bg-popover shadow-md">
          {suggestions.map((suggestion) => (
            <button type="button" key={suggestion.placeId} onClick={() => select(suggestion)} className="block w-full px-3 py-2 text-left text-sm hover:bg-muted">
              {suggestion.label}
            </button>
          ))}
        </div>
      )}
      {value ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-success/40 bg-success/5 px-3 py-2">
          <p className="text-xs text-success">{value.normalizedAddress} · {value.city}, {value.state} {value.zip}</p>
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-1 text-xs font-medium text-destructive hover:underline"
            aria-label="Clear selected office location"
          >
            <X className="h-3 w-3" />
            Clear location
          </button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Select a Google-resolved US place to save canonical coordinates.</p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}