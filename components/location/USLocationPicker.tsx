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

// Deterministic display formatter for the selected location. The full
// normalized address is preferred when meaningful; otherwise city/state is
// used. Candidate strings are trimmed/case-normalized and de-duplicated so a
// place-level result (e.g. normalizedAddress "Dallas, TX" with city "Dallas",
// state "TX") is never shown twice.
export function formatSelectedLocation(location: SelectedUSLocation): string {
  const address = (location.normalizedAddress || '').trim()
  const cityState = [location.city, location.state].filter(Boolean).map((s) => s.trim()).join(', ').trim()
  const zip = (location.zip || '').trim()

  const normalized = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
  if (address) {
    if (cityState && normalized(address) === normalized(cityState)) {
      // The address is exactly the city/state — show it once, with ZIP if present.
      return [cityState, zip].filter(Boolean).join(' ')
    }
    return address
  }
  return [cityState, zip].filter(Boolean).join(' ')
}

export function USLocationPicker({ value, onChange, onClear }: {
  value?: SelectedUSLocation
  onChange: (location?: SelectedUSLocation) => void
  // Fires ONLY for the explicit "Clear location" action — never for typing
  // (typing calls onChange(undefined) to invalidate unvalidated text). The
  // parent uses this to persist the cleared state so it survives a refresh.
  onClear?: () => void
}) {
  // The search input is purely transient UI state: it is seeded once from the
  // canonical value (draft resume) and afterwards updated ONLY by user actions
  // (typing, select, clear). It must NOT be synchronized from `value` on every
  // render or in an effect:
  //
  //  - A render-body sync caused the Phase 8.24.4 "Too many re-renders" loop
  //    (a comparison like `undefined !== ''` never converges).
  //  - An effect sync would erase the user's typing, because typing calls
  //    onChange(undefined) to invalidate unvalidated text, which sets `value`
  //    to undefined and would reset the input to '' on every keystroke.
  //
  // The parent clears the canonical location (setValue(undefined)) and the
  // confirmation panel is gated on `value?.placeId`, so no stale display can
  // survive a clear; clear() also empties this input directly.
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
    // Reset every piece of state this component owns that represents the
    // selected location: the search input, any open suggestions, and any error.
    // Then clear the single canonical value — the parent (wizard/form) clears
    // its `location` field and every derived address field in its
    // onChange(undefined) handler, so the confirmation panel below (which
    // renders from `value`) disappears. The input is emptied here directly
    // (the canonical `value` is not synchronized into it), so no stale address
    // text survives a clear and no re-render loop is possible.
    setInput('')
    setSuggestions([])
    setError('')
    onChange(undefined)
    onClear?.()
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
      {value && value.placeId ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-success/40 bg-success/5 px-3 py-2">
          <p className="text-xs text-success">{formatSelectedLocation(value)}</p>
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