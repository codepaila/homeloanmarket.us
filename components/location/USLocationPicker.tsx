'use client'

import { useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'

export type SelectedUSLocation = {
  placeId?: string
  normalizedAddress: string
  city: string
  state: string
  zip: string
  latitude: number
  longitude: number
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
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to resolve location')
      setInput(data.location.normalizedAddress || place.label)
      setSuggestions([])
      onChange(data.location)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to resolve location')
    }
  }

  return (
    <div className="relative space-y-2">
      <label className="text-sm font-medium">Validated US location *</label>
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          value={input}
          onChange={(event) => { setInput(event.target.value); setSuggestions([]); onChange(undefined) }}
          placeholder="Search your office location"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-9 text-sm"
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
      {value && <p className="text-xs text-success">{value.city}, {value.state} {value.zip}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {!value && <p className="text-xs text-muted-foreground">Select a Google-resolved US place to save canonical coordinates.</p>}
    </div>
  )
}
