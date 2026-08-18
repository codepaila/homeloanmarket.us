"use client"
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { useRouter } from 'next/navigation'
import { MapPin, Search } from 'lucide-react'
import { buildBrokerSearchUrl, resolveSearchSubmission } from '@/lib/search'
import type { ResolvedLocation } from '@/lib/search'


function SearchSection() {
  const router = useRouter()
  const prefersReducedMotion = useReducedMotion()
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)

  const [locationSuggestions, setLocationSuggestions] = useState<Array<{ placeId: string; label: string }>>([])
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1)
  const requestRef = useRef(0)
  const searchRef = useRef<HTMLDivElement>(null)
  const suggestionsOpenRef = useRef(false)

  const [selectedLocation, setSelectedLocation] = useState<ResolvedLocation | null>(null)

  useEffect(() => {
    const value = query.trim()
    if (value.length < 2 || selectedLocation?.normalizedAddress === value) {
      requestRef.current += 1
      setSearching(false)
      setLocationSuggestions([])
      setActiveSuggestionIndex(-1)
      return
    }
    const requestId = ++requestRef.current
    const controller = new AbortController()
    setSearching(true)
    const timer = window.setTimeout(() => {
      fetch(`/api/location/autocomplete?input=${encodeURIComponent(value)}`, { signal: controller.signal })
        .then((response) => response.json())
        .then((data) => {
          if (requestId !== requestRef.current) return
          setSearching(false)
          setLocationSuggestions(Array.isArray(data.suggestions) ? data.suggestions : [])
          setActiveSuggestionIndex(-1)
        })
        .catch(() => {
          if (controller.signal.aborted || requestId !== requestRef.current) return
          setSearching(false)
          setLocationSuggestions([])
        })
    }, 300)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query, selectedLocation])

  async function selectLocation(suggestion: { placeId: string; label: string }) {
    try {
      const response = await fetch('/api/location/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeId: suggestion.placeId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to resolve location')
      setSelectedLocation(data.location)
      setQuery(data.location.normalizedAddress || suggestion.label)
      setLocationSuggestions([])
      setActiveSuggestionIndex(-1)
      // Selecting a Google suggestion is a confirmed location: radius search is
      // active immediately (default 25 miles) and navigates to the listing.
      router.push(buildBrokerSearchUrl(data.location, ''))
    } catch {
      setSelectedLocation(null)
      setLocationSuggestions([])
      setActiveSuggestionIndex(-1)
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setLocationSuggestions([])
      setActiveSuggestionIndex(-1)
      return
    }
    if (event.key === 'ArrowDown' && locationSuggestions.length > 0) {
      event.preventDefault()
      setActiveSuggestionIndex((current) => (current + 1) % locationSuggestions.length)
      return
    }
    if (event.key === 'ArrowUp' && locationSuggestions.length > 0) {
      event.preventDefault()
      setActiveSuggestionIndex((current) => (current - 1 + locationSuggestions.length) % locationSuggestions.length)
      return
    }
    if (event.key === 'Enter') {
      if (activeSuggestionIndex >= 0 && locationSuggestions[activeSuggestionIndex]) {
        event.preventDefault()
        selectLocation(locationSuggestions[activeSuggestionIndex])
      }
      // Otherwise allow the form submit (typed search).
    }
  }

  // Track whether suggestions are open in a ref so the once-registered
  // outside-click listener can read it without re-subscribing every render.
  useEffect(() => {
    suggestionsOpenRef.current = locationSuggestions.length > 0 || searching
  }, [locationSuggestions, searching])

  // Close the suggestions dropdown when the user points/clicks outside the
  // search component (works for mouse and touch via pointer events).
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (!suggestionsOpenRef.current) return
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        requestRef.current += 1
        setLocationSuggestions([])
        setActiveSuggestionIndex(-1)
        setSearching(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault()
    const text = query.trim()
    if (!text) return
    setSearching(true)
    try {
      // Manual text (city, "City, ST", or ZIP) is resolved through the
      // server-side geocoder. Radius activates only when valid coordinates are
      // returned; otherwise this is a plain text search with no radius.
      const result = await resolveSearchSubmission(text, selectedLocation)
      if (result.status === 'resolved') {
        setSelectedLocation(result.location)
        setQuery(result.location.normalizedAddress || text)
        setLocationSuggestions([])
        setActiveSuggestionIndex(-1)
        router.push(buildBrokerSearchUrl(result.location, ''))
      } else {
        router.push(buildBrokerSearchUrl(null, text))
      }
    } finally {
      setSearching(false)
    }
  }

  const motionTransition = (delay: number) => ({
    duration: prefersReducedMotion ? 0 : 0.5,
    delay: prefersReducedMotion ? 0 : delay,
    ease: [0.25, 0.46, 0.45, 0.94] as const,
  })

  return (
    <div className="max-w-8xl mx-auto px-4 py-16 md:py-20 ">
      {/* Heading */}
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={motionTransition(0.1)}
        className="text-center text-2xl font-bold text-secondary sm:text-3xl md:text-4xl"
      >
        <span className="text-primary">
          Find Home Loan Experts
        </span>
        <span className="text-secondary"> Near You</span>
      </motion.h2>

      <motion.form
        onSubmit={handleSearch}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={motionTransition(0.25)}
        className="mt-6 mx-auto max-w-4xl"
      >
        {/* Main Search Bar */}
        <div ref={searchRef} className="relative flex items-center gap-3 rounded-xl bg-white px-4 py-2.5 shadow-sm ring-1 ring-black/5 transition-all focus-within:ring-2 focus-within:ring-primary/50">
          <Search className="h-5 w-5 flex-shrink-0 text-primary" />
          <input
            type="search"
            name="search"
            value={query}
            onChange={(event) => { setQuery(event.target.value); setSelectedLocation(null); setActiveSuggestionIndex(-1) }}
            onKeyDown={handleKeyDown}
            placeholder="Search by city or ZIP code"
            className="flex-1 bg-transparent py-1 text-sm font-medium text-secondary placeholder:text-muted-foreground/70 focus:outline-none"
            aria-label="Search brokers by city or ZIP code"
            aria-expanded={locationSuggestions.length > 0 || searching}
            aria-autocomplete="list"
            aria-controls="broker-search-suggestions"
            role="combobox"
          />
          {(searching || locationSuggestions.length > 0) && (
            <div id="broker-search-suggestions" className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-border bg-white shadow-xl" role="listbox" aria-label="Location suggestions">
              {searching && locationSuggestions.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted-foreground">Searching brokers…</p>
              ) : locationSuggestions.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted-foreground">No brokers found</p>
              ) : (
                locationSuggestions.map((suggestion, index) => (
                  <button type="button" key={suggestion.placeId} role="option" aria-selected={index === activeSuggestionIndex} onMouseDown={(event) => event.preventDefault()} onClick={() => selectLocation(suggestion)} className={`flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-secondary hover:bg-muted focus:bg-muted focus:outline-none ${index === activeSuggestionIndex ? 'bg-muted' : ''}`}>
                    <MapPin className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    {suggestion.label}
                  </button>
                ))
              )}
            </div>
          )}
          {/* <button
            type="submit"
            disabled={searching || !query.trim()}
            aria-label="Search brokers"
            className="shrink-0 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-50"
          >
            {searching ? 'Searching…' : 'Search'}
          </button> */}
        </div>
      </motion.form>
    </div>
  )
}

export default SearchSection
