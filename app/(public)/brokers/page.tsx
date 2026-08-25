/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useReducedMotion } from 'motion/react'
import {
  Search,
  Grid,
  List,
  X,
  ChevronDown,
  SlidersHorizontal,
  MapPin,
} from 'lucide-react'
import { BrokerGridCard } from '@/components/brokers'
import { BrokerCardSkeleton } from '@/components/design/BrokerCardSkeleton'
import { EmptyState } from '@/components/design/EmptyState'
import { useAllBrokers } from '@/hooks/useClient'
import { PAGE_SIZE } from '@/utils'
import { cn } from '@/lib/utils'
import { AdvertisementRenderer } from '@/components/advertisements'
import { parseResolvedLocation, DEFAULT_RADIUS_MILES, type ResolvedLocation } from '@/lib/search'

const sortOptions = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'rating', label: 'Highest Rated' },
  { value: 'experience', label: 'Most Experienced' },
  { value: 'reviews', label: 'Most Reviewed' },
]

const ratingOptions = [
  { value: '0', label: 'Any Rating' },
  { value: '4.5', label: '4.5+ Stars' },
  { value: '4', label: '4+ Stars' },
  { value: '3.5', label: '3.5+ Stars' },
]

const experienceOptions = [
  { value: '', label: 'Any experience' },
  { value: '5', label: '5+ years' },
  { value: '10', label: '10+ years' },
  { value: '15', label: '15+ years' },
]

export default function BrokersPage() {
  const reducedMotion = useReducedMotion()
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [committedSearch, setCommittedSearch] = useState('')
  const [locationSuggestions, setLocationSuggestions] = useState<Array<{ placeId: string; label: string }>>([])
  const [locationError, setLocationError] = useState('')
  const [selectedLocation, setSelectedLocation] = useState<ResolvedLocation | null>(null)
  const [radius, setRadius] = useState(25)
  const [minExperience, setMinExperience] = useState('')
  const [minRating, setMinRating] = useState('0')
  const [featuredOnly, setFeaturedOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [sortBy, setSortBy] = useState('relevance')
  const [urlHydrated, setUrlHydrated] = useState(false)
  const filtersButtonRef = useRef<HTMLButtonElement>(null)
  const autocompleteRequestRef = useRef(0)
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1)
  const searchRef = useRef<HTMLDivElement>(null)
  const suggestionsOpenRef = useRef(false)

  // Hydrate filters from URL query parameters
  useEffect(() => {
    if (typeof window === 'undefined') return
    const syncFromUrl = () => {
      const params = new URLSearchParams(window.location.search)
      const q = params.get('search') || params.get('q') || ''
      const locationText = params.get('location') || params.get('locationLabel') || ''
      // A confirmed Google location carries coordinates (+ token). Bare city
      // text in the URL is NOT a confirmed location — it is a free-text search.
      const resolvedLocation = parseResolvedLocation(params)
      const radiusParamStr = params.get('radius')
      const radiusParam = radiusParamStr === null ? null : Number(radiusParamStr)
      const radiusValue = radiusParam !== null && Number.isFinite(radiusParam) && radiusParam >= 0 && radiusParam <= 100 ? radiusParam : DEFAULT_RADIUS_MILES
      setRadius(radiusValue)
      if (resolvedLocation) {
        setSelectedLocation(resolvedLocation)
        setSearchInput(resolvedLocation.normalizedAddress || locationText)
        setSearch(q || '')
        setCommittedSearch(q || '')
      } else {
        setSelectedLocation(null)
        const searchTerm = q || locationText || ''
        setSearch(searchTerm)
        setCommittedSearch(searchTerm)
        setSearchInput(locationText || searchTerm)
      }
      setMinExperience(params.get('experience') || '')
      setMinRating(params.get('rating') || '0')
      setFeaturedOnly(params.get('featured') === 'true')
      const pageParam = Number(params.get('page'))
      setPage(Number.isInteger(pageParam) && pageParam > 1 ? pageParam : 1)
    }
    syncFromUrl()
    window.addEventListener('popstate', syncFromUrl)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrlHydrated(true)
    return () => window.removeEventListener('popstate', syncFromUrl)
  }, [])

  const { brokers, total, totalPages, isLoading, error: brokerError } = useAllBrokers(
    page,
    PAGE_SIZE,
    parseFloat(minRating),
    undefined,
    undefined,
    search,
    featuredOnly ? 'FEATURED' : undefined,
    minExperience ? parseInt(minExperience) : undefined,
    undefined,
    undefined,
    selectedLocation ? { latitude: selectedLocation.latitude, longitude: selectedLocation.longitude, city: selectedLocation.city, state: selectedLocation.state, zip: selectedLocation.zip, token: selectedLocation.token } : undefined,
     radius,
  )

  // Typing only updates local input state. The broker query, location
  // resolution, and advertisement lookup run exclusively on explicit submit
  // (Enter or the Search button) — never on every keystroke.

  useEffect(() => {
    const value = searchInput.trim()
    if (value.length < 2 || selectedLocation?.normalizedAddress === value) {
      autocompleteRequestRef.current += 1
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocationSuggestions([])
      setActiveSuggestionIndex(-1)
      return
    }
    const requestId = ++autocompleteRequestRef.current
    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/location/autocomplete?input=${encodeURIComponent(value)}`, { signal: controller.signal })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Location autocomplete is unavailable')
        if (requestId !== autocompleteRequestRef.current) return
        setLocationSuggestions(Array.isArray(data.suggestions) ? data.suggestions : [])
        setLocationError('')
        setActiveSuggestionIndex(-1)
      } catch (error) {
        if (controller.signal.aborted || requestId !== autocompleteRequestRef.current) return
        setLocationSuggestions([])
        setLocationError(error instanceof Error ? error.message : 'Location autocomplete is unavailable')
      }
    }, 200)
    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [searchInput, selectedLocation])

  // Track whether the autocomplete dropdown is open in a ref so the
  // once-registered outside-click listener can read it without re-subscribing.
  useEffect(() => {
    suggestionsOpenRef.current = locationSuggestions.length > 0
  }, [locationSuggestions])

  // Close the autocomplete dropdown when the user points/clicks outside the
  // search component (works for mouse and touch via pointer events).
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (!suggestionsOpenRef.current) return
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        autocompleteRequestRef.current += 1
        setLocationSuggestions([])
        setActiveSuggestionIndex(-1)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  const selectLocation = async (suggestion: { placeId: string; label: string }) => {
    try {
      const response = await fetch('/api/location/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeId: suggestion.placeId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to resolve location')
      setSelectedLocation(data.location)
      setSearchInput(data.location.normalizedAddress || suggestion.label)
      setSearch('')
      setCommittedSearch('')
      setLocationSuggestions([])
      setLocationError('')
      setActiveSuggestionIndex(-1)
      setPage(1)
      // A Google-selected location is a confirmed location: radius defaults to 25.
      setRadius(DEFAULT_RADIUS_MILES)
    } catch (error) {
      setSelectedLocation(null)
      setLocationSuggestions([])
      setLocationError(error instanceof Error ? error.message : 'Selected location could not be resolved')
    }
  }

  // Selection-driven search: location search is ONLY initiated by choosing an
  // autocomplete suggestion (click or Enter). Typing text never geocodes, never
  // runs a broker/radius search, and never reuses stale coordinates. When no
  // suggestion is available, Enter/Search shows a non-blocking hint instead.
  const selectSuggestion = (index: number) => {
    const suggestion = locationSuggestions[index]
    if (suggestion) selectLocation(suggestion)
  }

  const handleSearchSubmit = () => {
    const value = searchInput.trim()
    if (!value) return
    if (locationSuggestions.length > 0) {
      // Prefer the highlighted suggestion, otherwise the first valid one.
      const index = activeSuggestionIndex >= 0 && activeSuggestionIndex < locationSuggestions.length ? activeSuggestionIndex : 0
      selectSuggestion(index)
    } else {
      // No suggestion: never fall back to a free-text geocode/radius search.
      setLocationError('Select a location from the suggestions to search nearby brokers.')
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1)
  }, [search, minExperience, minRating, featuredOnly, radius, selectedLocation])

  // Normalize an out-of-range page (e.g. a stale ?page= URL or a search that
  // narrowed the result set) to the last valid page instead of rendering empty.
  useEffect(() => {
    if (totalPages > 0 && page > totalPages) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPage(totalPages)
    }
  }, [page, totalPages])

  useEffect(() => {
    if (!urlHydrated || typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const setOrDelete = (key: string, value: string) => value ? params.set(key, value) : params.delete(key)
    setOrDelete('search', committedSearch)
    params.delete('q')
    setOrDelete('experience', minExperience)
    setOrDelete('rating', minRating === '0' ? '' : minRating)
    setOrDelete('featured', featuredOnly ? 'true' : '')
    // Persist the full canonical location so refresh, pagination, and
    // back/forward navigation restore the radius search. This mirrors
    // buildBrokerSearchUrl.
    setOrDelete('location', selectedLocation?.normalizedAddress || '')
    setOrDelete('locationCity', selectedLocation?.city || '')
    setOrDelete('locationState', selectedLocation?.state || '')
    setOrDelete('locationZip', selectedLocation?.zip || '')
    setOrDelete('latitude', selectedLocation ? String(selectedLocation.latitude) : '')
    setOrDelete('longitude', selectedLocation ? String(selectedLocation.longitude) : '')
    setOrDelete('locationToken', selectedLocation?.token || '')
    setOrDelete('radius', selectedLocation ? String(radius) : '')
    setOrDelete('page', page > 1 ? String(page) : '')
    const query = params.toString()
    window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`)
  }, [committedSearch, featuredOnly, minExperience, minRating, page, radius, selectedLocation, urlHydrated])

  const clearAllFilters = useCallback(() => {
    setLocationSuggestions([])
    setSearchInput('')
    setSearch('')
    setCommittedSearch('')
    setSelectedLocation(null)
    setRadius(25)
    setMinExperience('')
    setMinRating('0')
    setFeaturedOnly(false)
    setLocationError('')
    setActiveSuggestionIndex(-1)
  }, [])

  const hasActiveFilters = Boolean(search || selectedLocation || minExperience || minRating !== '0' || featuredOnly)

  const activeFilterCount = [
    search,
    selectedLocation && 'radius',
    minExperience,
    minRating !== '0' && 'rating',
    featuredOnly && 'featured',
  ].filter(Boolean).length

  const sortedBrokers = [...(brokers || [])].sort((a: any, b: any) => {
    switch (sortBy) {
      case 'rating':
        return (b.avgRating || 0) - (a.avgRating || 0)
      case 'experience':
        return (b.experienceYears || 0) - (a.experienceYears || 0)
      case 'reviews':
        return (b.totalReviews || 0) - (a.totalReviews || 0)
      default:
        return 0
    }
  })

  // Lock body scroll and close with Escape while the filter sheet is open
  useEffect(() => {
    if (!filtersOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFiltersOpen(false)
        filtersButtonRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    const focusClose = () => {
      const close = document.querySelector<HTMLButtonElement>('[data-filter-close]')
      if (close && close.offsetParent) close.focus()
    }
    const raf = window.requestAnimationFrame(focusClose)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.cancelAnimationFrame(raf)
      document.body.style.overflow = previousOverflow
    }
  }, [filtersOpen])

  const openFilters = useCallback(() => setFiltersOpen(true), [])
  const closeFilters = useCallback(() => {
    setFiltersOpen(false)
    filtersButtonRef.current?.focus()
  }, [])

  const sectionLabel = (text: string) => (
    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{text}</p>
  )

  const filtersPanel = (
    <div className="space-y-6">
      <div>
          <div className="space-y-2 rounded-xl border border-border bg-background p-3">
            <label className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <span>Search Radius</span>
              <span className="font-medium normal-case text-text-main">{radius} miles</span>
            </label>
            <div className="flex items-center justify-between text-xs text-muted-foreground"><span>0 miles</span><span>100 miles</span></div>
            <input type="range" min="0" max="100" step="1" value={radius} onChange={(event) => setRadius(Number(event.target.value))} aria-label="Search radius in miles" className="w-full accent-primary" />
            <p className="text-xs text-muted-foreground">Search for brokers within this radius of the selected location.</p>
          </div>
        </div>

      {/* <div>
        {sectionLabel('Experience')}
        <div className="mt-2.5 space-y-3">
          <FilterSelect
            label="Minimum experience"
            value={minExperience}
            onChange={setMinExperience}
            options={experienceOptions}
          />
        </div>
      </div> */}

      {/* <div>
        {sectionLabel('Quality')}
        <div className="mt-2.5 space-y-3">
          <FilterSelect
            label="Minimum rating"
            value={minRating}
            onChange={setMinRating}
            options={ratingOptions}
          />
          <FilterSelect
            label="Partner status"
            value={featuredOnly ? 'FEATURED' : ''}
            onChange={(value) => setFeaturedOnly(value === 'FEATURED')}
            options={[
              { value: '', label: 'All verified brokers' },
              { value: 'FEATURED', label: 'Featured partners' },
            ]}
          />
        </div>
      </div> */}

      <div className="border-t border-border pt-4">
        {sectionLabel('Active filters')}
        <div className="mt-2.5">
          {hasActiveFilters ? (
            <div className="flex flex-wrap gap-2">
              {search && <FilterChip label={`Search: "${search}"`} onRemove={() => { setSearchInput(''); setSearch(''); setCommittedSearch(''); setLocationSuggestions([]); setActiveSuggestionIndex(-1) }} />}
              {selectedLocation && <FilterChip label={`${radius} mile radius`} onRemove={() => setRadius(25)} />}
              {minExperience && <FilterChip label={`${minExperience}+ years`} onRemove={() => setMinExperience('')} />}
              {minRating !== '0' && <FilterChip label={`${minRating}+ rating`} onRemove={() => setMinRating('0')} />}
              {featuredOnly && <FilterChip label="Featured" onRemove={() => setFeaturedOnly(false)} />}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No filters applied.</p>
          )}
        </div>
      </div>
    </div>
  )

  const sheetTransition = {
    duration: reducedMotion ? 0 : 0.28,
    ease: [0.4, 0, 0.2, 1] as const,
  }

  const drawerActions = (
    <div className="flex items-center gap-3 border-t border-border p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <button type="button"
        onClick={clearAllFilters}
        className="flex-1 rounded-xl border border-border px-4 py-3 text-sm font-medium text-text-main transition-colors hover:bg-muted"
      >
        Clear all
      </button>
      <button type="button"
        onClick={closeFilters}
        className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-primary/90"
      >
        Apply filters
      </button>
    </div>
  )

  return (
    <div className="min-h-screen bg-background">
      {/* Discovery header */}
      <section className="relative overflow-hidden border-b border-border bg-surface py-8 md:py-10">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/5 blur-3xl"
          aria-hidden="true"
        />
        <div className="container-custom relative">
          <div className="mx-auto max-w-3xl text-center">
            {/* <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Verified mortgage broker directory
            </div> */}
            <h1 className="heading-2 text-text-main text-balance">
              Find the right mortgage broker
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-base text-text-muted md:text-lg">
              Search by broker, company, ZIP code, address or location, then compare verified mortgage professionals.
            </p>
            {/* <p className="mx-auto mt-3 max-w-3xl text-sm text-text-muted">
              HomeLoanMarket helps you find and compare verified mortgage brokers across the United States.
              Search by city, state, or ZIP code to discover local mortgage professionals, compare their
              experience and ratings, and connect with the right home-loan expert for your situation.
            </p> */}
            {/* {!isLoading && (
              <p className="mt-4 text-sm font-medium text-primary">
                {total || 0} verified broker{total === 1 ? '' : 's'} currently listed
              </p>
            )} */}
          </div>
        </div>
      </section>

      {/* Sticky search + toolbar */}
      <section className="sticky top-16 z-30 border-b border-border bg-card/80 backdrop-blur-lg md:top-[72px]">
        <div className="container-custom py-4 md:py-5 grid grid-cols-5 gap-3 md:gap-5 items-center">
          <div ref={searchRef} className="relative  col-span-4 sm:col-span-3">
            <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-text-muted" />
            <input
              type="search"
              name="q"
              role="combobox"
              autoComplete="off"
              aria-autocomplete="list"
              aria-label="Search brokers"
              aria-expanded={locationSuggestions.length > 0}
              aria-controls="broker-location-suggestions"
              aria-activedescendant={activeSuggestionIndex >= 0 ? `broker-location-suggestion-${activeSuggestionIndex}` : undefined}
              placeholder="Search by City , ZIP code"
              value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value)
                  setSelectedLocation(null)
                  setRadius(25)
                  setLocationError('')
                  setActiveSuggestionIndex(-1)
                }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown' && locationSuggestions.length > 0) {
                  e.preventDefault()
                  setActiveSuggestionIndex((current) => (current + 1) % locationSuggestions.length)
                }
                if (e.key === 'ArrowUp' && locationSuggestions.length > 0) {
                  e.preventDefault()
                  setActiveSuggestionIndex((current) => (current - 1 + locationSuggestions.length) % locationSuggestions.length)
                }
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (activeSuggestionIndex >= 0 && locationSuggestions[activeSuggestionIndex]) selectLocation(locationSuggestions[activeSuggestionIndex])
                  else void handleSearchSubmit()
                }
                if (e.key === 'Escape') {
                  setLocationSuggestions([])
                  setActiveSuggestionIndex(-1)
                }
              }}
              className="h-10 w-full rounded-xl border border-border bg-background pl-11 pr-2 text-sm text-text-main shadow-soft placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {locationSuggestions.length > 0 && (
              <div id="broker-location-suggestions" className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-border bg-card shadow-large" role="listbox" aria-label="Location suggestions">
                {locationSuggestions.map((suggestion) => (
                  <button
                    type="button"
                    key={suggestion.placeId}
                    id={`broker-location-suggestion-${locationSuggestions.indexOf(suggestion)}`}
                    role="option"
                    aria-selected={locationSuggestions.indexOf(suggestion) === activeSuggestionIndex}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectLocation(suggestion)}
                    className={cn('flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-text-main hover:bg-muted focus:bg-muted focus:outline-none', locationSuggestions.indexOf(suggestion) === activeSuggestionIndex && 'bg-muted')}
                  >
                    <MapPin className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    {suggestion.label}
                  </button>
                ))}
              </div>
            )}
            {locationError && <p role="status" className="absolute inset-x-0 top-full z-50 mt-2 rounded-xl border border-destructive/30 bg-card p-3 text-sm text-destructive">{locationError}</p>}
            {/* <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
              {searchInput && (
                <button type="button"
                 onClick={() => { setSearchInput(''); setSearch(''); setCommittedSearch(''); setSelectedLocation(null); setRadius(25); setLocationSuggestions([]); setLocationError(''); setActiveSuggestionIndex(-1) }}
                  className="rounded-full p-1 text-text-muted hover:bg-muted hover:text-text-main"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div> */}
          </div>
          <div className="col-span-1 sm:block hidden">
              <div className="text-sm text-text-muted">
              {isLoading ? (
                <span className="inline-block h-4 w-16 animate-pulse rounded bg-muted" />
              ) : (
                <span>
                  <span className="font-semibold text-text-main">{total || 0}</span>{' '}
                  <span className="hidden sm:inline">mortgage broker{total === 1 ? '' : 's'} found</span>
                  <span className="sm:hidden">broker{total === 1 ? '' : 's'}</span>
                </span>
              )}
            </div>
          </div>
          <div className="col-span-1 flex justify-end">

              <button
                ref={filtersButtonRef}
                type="button"
                onClick={openFilters}
                className={cn(
                  ' inline-flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-sm font-medium text-text-main transition-colors hover:bg-muted',
                  filtersOpen && 'bg-muted',
                )}
                aria-expanded={filtersOpen}
                aria-controls="broker-filter-sheet"
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span className="hidden sm:block">

                Filters
                </span>
                {hasActiveFilters && (
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              </div>
             
{/* 
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                ref={filtersButtonRef}
                type="button"
                onClick={openFilters}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-sm font-medium text-text-main transition-colors hover:bg-muted',
                  filtersOpen && 'bg-muted',
                )}
                aria-expanded={filtersOpen}
                aria-controls="broker-filter-sheet"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filters
                {hasActiveFilters && (
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              <div className="hidden items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-sm text-text-muted sm:inline-flex">
                <span>Sort:</span>
                <Select
                  value={sortBy}
                  onValueChange={setSortBy}
                  options={sortOptions}
                  triggerClassName="border-0 shadow-none bg-transparent text-text-main font-medium"
                />
              </div>

              <div className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-sm">
                <span className="hidden text-text-muted sm:inline">View:</span>
                <button type="button"
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    'rounded-md p-1 text-text-muted transition-colors hover:bg-muted hover:text-text-main',
                    viewMode === 'grid' && 'bg-muted text-primary',
                  )}
                  aria-label="Grid view"
                >
                  <Grid className="h-4 w-4" />
                </button>
                <button type="button"
                  onClick={() => setViewMode('list')}
                  className={cn(
                    'rounded-md p-1 text-text-muted transition-colors hover:bg-muted hover:text-text-main',
                    viewMode === 'list' && 'bg-muted text-primary',
                  )}
                  aria-label="List view"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="text-sm text-text-muted">
              {isLoading ? (
                <span className="inline-block h-4 w-16 animate-pulse rounded bg-muted" />
              ) : (
                <span>
                  <span className="font-semibold text-text-main">{total || 0}</span>{' '}
                  <span className="hidden sm:inline">mortgage broker{total === 1 ? '' : 's'} found</span>
                  <span className="sm:hidden">broker{total === 1 ? '' : 's'}</span>
                </span>
              )}
            </div>
          </div> */}
        </div>
      </section>

      {/* Backdrop */}
      <AnimatePresence>
        {filtersOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.2 }}
            className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px]"
            onClick={closeFilters}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Filter sheet — mobile bottom sheet */}
      <AnimatePresence>
        {filtersOpen && (
          <motion.div
            id="broker-filter-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Filters"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={sheetTransition}
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col overflow-hidden rounded-t-2xl bg-card shadow-large md:hidden"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-text-main">Filters</h2>
                <p className="text-xs text-muted-foreground">Refine mortgage brokers</p>
              </div>
              <button type="button"
                data-filter-close
                onClick={closeFilters}
                className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-text-main"
                aria-label="Close filters"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 space-y-6 overflow-y-auto px-5 py-6">
              {filtersPanel}
            </div>
            {drawerActions}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter sheet — desktop right drawer */}
      <AnimatePresence>
        {filtersOpen && (
          <motion.div
            id="broker-filter-sheet-desktop"
            role="dialog"
            aria-modal="true"
            aria-label="Filters"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={sheetTransition}
            className="fixed inset-y-0 right-0 z-50 hidden w-full max-w-[420px] flex-col bg-card shadow-large md:flex"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-text-main">Filters</h2>
                <p className="text-xs text-muted-foreground">Refine mortgage brokers</p>
              </div>
              <button type="button"
                data-filter-close
                onClick={closeFilters}
                className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-text-main"
                aria-label="Close filters"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 space-y-6 overflow-y-auto px-5 py-6">
              {filtersPanel}
            </div>
            {drawerActions}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <section className="py-8 md:py-12">
        <div className="container-custom">
          {isLoading ? (
            <BrokerCardSkeleton count={PAGE_SIZE} view={viewMode} />
          ) : brokerError ? (
            <EmptyState
              title="Unable to load brokers"
              description={brokerError instanceof Error ? brokerError.message : 'Broker search is temporarily unavailable. Please try again.'}
              action={
                <button type="button" onClick={() => window.location.reload()} className="btn btn-primary">
                  Try Again
                </button>
              }
            />
          ) : sortedBrokers && sortedBrokers.length > 0 ? (
            <>
              <motion.div
                className={cn(
                  'grid gap-6',
                  viewMode === 'grid'
                    ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                    : 'grid-cols-1',
                )}
                layout
              >
                {sortedBrokers.map((broker: any,ind:number) => (
                  <BrokerGridCard
                    key={broker.id+"hlm"+ind}
                    slug={broker.profileSlug}
                    name={broker.displayName || broker.companyName || 'Mortgage Broker'}
                    company={broker.companyName || 'Mortgage Broker'}
                    location={[broker.city, broker.state].filter(Boolean).join(', ') || 'United States'}
                    nmls={broker.nmls}
                    logo={broker.logo}
                    profileImage={broker.profileImage}
                    isPremium={broker.isFeatured === true}
                    isMortgageExpert={broker.isMortgageExpert === true}
                  />
                ))}
              </motion.div>

              {totalPages > 1 && (
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                />
              )}
            </>
          ) : (
            <EmptyState
              title="No mortgage brokers found"
              description={
                hasActiveFilters
                  ? 'Try adjusting your search filters or clearing all filters to see more mortgage brokers.'
                  : 'No mortgage brokers are currently listed on the platform.'
              }
              action={
                hasActiveFilters && (
                  <button type="button" onClick={clearAllFilters} className="btn btn-primary">
                    Clear All Filters
                  </button>
                )
              }
            />
          )}
        </div>
      </section>

      {selectedLocation && (
        <section className="border-t border-border bg-surface/40 py-8 md:py-10" aria-label="Related Local Resources">
          <div className="container-custom">
            <h2 className="text-xl font-bold text-text-main">Related Local Resources</h2>
            <p className="mt-1 text-sm text-text-muted">Resources serving {selectedLocation.city || selectedLocation.normalizedAddress}</p>
            <AdvertisementRenderer
              placement="BROKER_LISTING_LOCAL"
              location={{ latitude: selectedLocation.latitude, longitude: selectedLocation.longitude, token: selectedLocation.token }}
              className="mt-3"
            />
          </div>
        </section>
      )}
    </div>
  )
}

function FilterChip({
  label,
  onRemove,
}: {
  label: string
  onRemove: () => void
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary"
    >
      {label}
      <button type="button"
        onClick={onRemove}
        className="rounded-full p-0.5 text-primary/60 transition-colors hover:bg-primary/10 hover:text-primary"
        aria-label={`Remove ${label}`}
      >
        <X className="h-3 w-3" />
      </button>
    </motion.div>
  )
}

// function FilterSelect({
//   label,
//   value,
//   onChange,
//   options,
//   loading,
//   disabled,
// }: {
//   label: string
//   value: string
//   onChange: (val: string) => void
//   options: { value: string; label: string }[]
//   loading?: boolean
//   disabled?: boolean
// }) {
//   return (
//     <div className="space-y-1.5">
//       <label className="text-xs font-medium uppercase tracking-wide text-text-muted">
//         {label}
//       </label>
//       <div className="relative">
//         <select
//           value={value}
//           onChange={(e) => onChange(e.target.value)}
//           disabled={disabled || loading}
//           className={cn(
//             'w-full appearance-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-text-main',
//             'transition-all focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15',
//             (loading || disabled) && 'opacity-60',
//           )}
//         >
//           {options.map((opt) => (
//             <option key={opt.value} value={opt.value}>
//               {opt.label}
//             </option>
//           ))}
//         </select>
//         <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
//       </div>
//       {loading && <p className="text-xs text-text-muted">Loading mortgage brokers...</p>}
//     </div>
//   )
// }

// function Select({
//   value,
//   onValueChange,
//   options,
//   triggerClassName,
// }: {
//   value: string
//   onValueChange: (val: string) => void
//   options: { value: string; label: string }[]
//   triggerClassName?: string
// }) {
//   return (
//     <select
//       value={value}
//       onChange={(e) => onValueChange(e.target.value)}
//       className={cn(
//         'w-full appearance-none border-0 bg-transparent text-sm font-medium outline-none',
//         triggerClassName,
//       )}
//     >
//       {options.map((opt) => (
//         <option key={opt.value} value={opt.value}>
//           {opt.label}
//         </option>
//       ))}
//     </select>
//   )
// }

function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}) {
  // Build a compact page-number window around the current page with ellipses
  // for gaps, keeping the control usable on mobile.
  const pageItems: Array<number | 'ellipsis-start' | 'ellipsis-end'> = []
  const range = 1
  const start = Math.max(2, page - range)
  const end = Math.min(totalPages - 1, page + range)

  pageItems.push(1)
  if (start > 2) pageItems.push('ellipsis-start')
  for (let p = start; p <= end; p += 1) pageItems.push(p)
  if (end < totalPages - 1) pageItems.push('ellipsis-end')
  if (totalPages > 1) pageItems.push(totalPages)

  return (
    <nav className="mt-12 flex flex-wrap items-center justify-center gap-1.5" aria-label="Pagination">
      <button type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-text-main transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
      >
        Previous
      </button>

      {pageItems.map((item) =>
        item === 'ellipsis-start' || item === 'ellipsis-end' ? (
          <span key={item} className="px-1 text-sm text-text-muted" aria-hidden="true">…</span>
        ) : (
          <button type="button"
            key={item}
            onClick={() => onPageChange(item)}
            aria-current={item === page ? 'page' : undefined}
            className={cn(
              'h-9 min-w-9 rounded-lg border px-2 text-sm font-medium transition-colors',
              item === page
                ? 'border-primary bg-primary text-white'
                : 'border-border text-text-main hover:bg-muted',
            )}
          >
            {item}
          </button>
        ),
      )}

      <button type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-text-main transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
      >
        Next
      </button>
    </nav>
  )
}
