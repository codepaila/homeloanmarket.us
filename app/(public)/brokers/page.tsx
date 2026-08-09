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
} from 'lucide-react'
import { BrokerGridCard } from '@/components/brokers'
import { BrokerCardSkeleton } from '@/components/design/BrokerCardSkeleton'
import { EmptyState } from '@/components/design/EmptyState'
import { useAllBrokers } from '@/hooks/useClient'
import { fetchCities, fetchUSStates } from '@/lib/fetchClient'
import { PAGE_SIZE } from '@/utils'
import { cn } from '@/lib/utils'
import { AdvertisementRenderer } from '@/components/advertisements'

const sortOptions = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'rating', label: 'Highest Rated' },
  { value: 'experience', label: 'Most Experienced' },
  { value: 'reviews', label: 'Most Reviewed' },
]

const specializations = [
  'Home Purchase',
  'Refinance',
  'FHA Loan',
  'VA Loan',
  'USDA Loan',
  'Jumbo Loan',
  'Conventional Loan',
  'Construction Loan',
  'Home Equity Loan',
  'Cash-Out Refinance'
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

const languageOptions = [
  { value: '', label: 'Any language' },
  { value: 'English', label: 'English' },
  { value: 'Spanish', label: 'Spanish' },
  { value: 'Hindi', label: 'Hindi' },
  { value: 'Mandarin', label: 'Mandarin' },
  { value: 'Arabic', label: 'Arabic' },
  { value: 'Vietnamese', label: 'Vietnamese' },
  { value: 'Tagalog', label: 'Tagalog' },
  { value: 'Korean', label: 'Korean' },
  { value: 'French', label: 'French' },
]

export default function BrokersPage() {
  const reducedMotion = useReducedMotion()
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [city, setCity] = useState('')
  const [zip, setZip] = useState('')
  const [specialization, setSpecialization] = useState('')
  const [minExperience, setMinExperience] = useState('')
  const [language, setLanguage] = useState('')
  const [minRating, setMinRating] = useState('0')
  const [featuredOnly, setFeaturedOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [states, setStates] = useState<Array<{ code: string; name: string }>>([])
  const [selectedState, setSelectedState] = useState('')
  const [cityOptions, setCityOptions] = useState<string[]>([])
  const [isLoadingCities, setIsLoadingCities] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [sortBy, setSortBy] = useState('relevance')
  const [urlHydrated, setUrlHydrated] = useState(false)
  const filtersButtonRef = useRef<HTMLButtonElement>(null)

  // Hydrate filters from URL query parameters
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const q = params.get('search') || params.get('q')
    const cityParam = params.get('city')
    const zipParam = params.get('zip')
    const specParam = params.get('specialization')
    if (q) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearchInput(q)
      setSearch(q)
    }
    if (cityParam) setCity(cityParam)
    if (zipParam) setZip(zipParam)
    if (specParam) setSpecialization(specParam)
    if (params.get('experience')) setMinExperience(params.get('experience') || '')
    if (params.get('language')) setLanguage(params.get('language') || '')
    if (params.get('rating')) setMinRating(params.get('rating') || '0')
    if (params.get('featured') === 'true') setFeaturedOnly(true)
    const pageParam = Number(params.get('page'))
    if (Number.isInteger(pageParam) && pageParam > 1) setPage(pageParam)
    setUrlHydrated(true)
  }, [])

  const { brokers, total, totalPages, isLoading } = useAllBrokers(
    page,
    PAGE_SIZE,
    city,
    specialization,
    parseFloat(minRating),
    undefined,
    undefined,
    search,
    featuredOnly ? 'FEATURED' : undefined,
    minExperience ? parseInt(minExperience) : undefined,
    language || undefined,
    zip || undefined
  )

  useEffect(() => {
    let mounted = true
    fetchUSStates()
      .then((data) => {
        if (mounted) setStates(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        if (mounted) setStates([])
      })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let mounted = true
    if (!selectedState) return
    fetchCities(selectedState)
      .then((data) => {
        if (mounted) setCityOptions(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        if (mounted) setCityOptions([])
      })
      .finally(() => {
        if (mounted) setIsLoadingCities(false)
      })
    return () => {
      mounted = false
    }
  }, [selectedState])

  // Debounce the unified search field
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim())
    }, 400)
    return () => window.clearTimeout(timeout)
  }, [searchInput])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1)
  }, [search, city, zip, specialization, minExperience, language, minRating, featuredOnly])

  useEffect(() => {
    if (!urlHydrated || typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const setOrDelete = (key: string, value: string) => value ? params.set(key, value) : params.delete(key)
    setOrDelete('search', search)
    params.delete('q')
    setOrDelete('city', city)
    setOrDelete('zip', zip)
    setOrDelete('specialization', specialization)
    setOrDelete('experience', minExperience)
    setOrDelete('language', language)
    setOrDelete('rating', minRating === '0' ? '' : minRating)
    setOrDelete('featured', featuredOnly ? 'true' : '')
    setOrDelete('page', page > 1 ? String(page) : '')
    const query = params.toString()
    window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`)
  }, [city, featuredOnly, language, minExperience, minRating, page, search, specialization, urlHydrated, zip])

  const clearAllFilters = useCallback(() => {
    setSearchInput('')
    setSearch('')
    setCity('')
    setSelectedState('')
    setZip('')
    setSpecialization('')
    setMinExperience('')
    setLanguage('')
    setMinRating('0')
    setFeaturedOnly(false)
  }, [])

  const hasActiveFilters = Boolean(search || city || zip || specialization || minExperience || language || minRating !== '0' || featuredOnly)

  const activeFilterCount = [
    search,
    city,
    zip,
    specialization,
    minExperience,
    language,
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
        {sectionLabel('Location')}
        <div className="mt-2.5 space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              ZIP / Postal code
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={zip}
              onChange={(e) => setZip(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="e.g. 90210"
              aria-label="ZIP / Postal code"
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-secondary placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
            />
          </div>
          <FilterSelect
            label="State"
            value={selectedState}
            onChange={(value) => {
              setCity('')
              setCityOptions([])
              setIsLoadingCities(Boolean(value))
              setSelectedState(value)
            }}
            options={[
              { value: '', label: 'All states' },
              ...states.map((s) => ({ value: s.code, label: s.name })),
            ]}
          />
          <FilterSelect
            label="City"
            value={city}
            onChange={setCity}
            options={[
              { value: '', label: selectedState ? (isLoadingCities ? 'Loading cities...' : 'All Cities') : 'Select a state first' },
              ...cityOptions.map((c: string) => ({ value: c, label: c })),
            ]}
            loading={isLoadingCities}
            disabled={!selectedState}
          />
          <FilterSelect
            label="Specialization"
            value={specialization}
            onChange={setSpecialization}
            options={[
              { value: '', label: 'All Specializations' },
              ...specializations.map((s) => ({ value: s, label: s })),
            ]}
          />
        </div>
      </div>

      <div>
        {sectionLabel('Experience')}
        <div className="mt-2.5 space-y-3">
          <FilterSelect
            label="Minimum experience"
            value={minExperience}
            onChange={setMinExperience}
            options={experienceOptions}
          />
        </div>
      </div>

      <div>
        {sectionLabel('Language')}
        <div className="mt-2.5 space-y-3">
          <FilterSelect
            label="Language"
            value={language}
            onChange={setLanguage}
            options={languageOptions}
          />
        </div>
      </div>

      <div>
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
      </div>

      <div className="border-t border-border pt-4">
        {sectionLabel('Active filters')}
        <div className="mt-2.5">
          {hasActiveFilters ? (
            <div className="flex flex-wrap gap-2">
              {search && <FilterChip label={`Search: "${search}"`} onRemove={() => { setSearchInput(''); setSearch('') }} />}
              {zip && <FilterChip label={`ZIP: ${zip}`} onRemove={() => setZip('')} />}
              {city && <FilterChip label={city} onRemove={() => setCity('')} />}
              {specialization && <FilterChip label={specialization} onRemove={() => setSpecialization('')} />}
              {minExperience && <FilterChip label={`${minExperience}+ years`} onRemove={() => setMinExperience('')} />}
              {language && <FilterChip label={language} onRemove={() => setLanguage('')} />}
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
            <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Verified mortgage broker directory
            </div>
            <h1 className="heading-1 text-text-main text-balance">
              Find the right mortgage broker
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-base text-text-muted md:text-lg">
              Search by broker, company, ZIP code, address or location, then compare verified mortgage professionals.
            </p>
            {!isLoading && (
              <p className="mt-4 text-sm font-medium text-primary">
                {total || 0} verified broker{total === 1 ? '' : 's'} currently listed
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="container-custom py-3 md:py-4">
        <AdvertisementRenderer placement="BROKER_LISTING" />
      </div>

      {/* Sticky search + toolbar */}
      <section className="sticky top-16 z-30 border-b border-border bg-card/80 backdrop-blur-lg md:top-[72px]">
        <div className="container-custom py-4 md:py-5">
          <div className="relative mx-auto max-w-4xl">
            <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-text-muted" />
            <input
              type="search"
              name="q"
              aria-label="Search brokers"
              placeholder="Search by broker, company, ZIP code, address or location..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setSearch(searchInput.trim())
              }}
              className="h-12 w-full rounded-xl border border-border bg-background pl-11 pr-10 text-sm text-text-main shadow-soft placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {searchInput && (
              <button type="button"
                onClick={() => { setSearchInput(''); setSearch('') }}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-text-muted hover:bg-muted hover:text-text-main"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

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
          </div>

          {hasActiveFilters && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {search && <FilterChip label={`Search: "${search}"`} onRemove={() => { setSearchInput(''); setSearch('') }} />}
              {zip && <FilterChip label={`ZIP: ${zip}`} onRemove={() => setZip('')} />}
              {city && <FilterChip label={`City: ${city}`} onRemove={() => setCity('')} />}
              {specialization && <FilterChip label={`Specialization: ${specialization}`} onRemove={() => setSpecialization('')} />}
              {minExperience && <FilterChip label={`${minExperience}+ years`} onRemove={() => setMinExperience('')} />}
              {language && <FilterChip label={`Language: ${language}`} onRemove={() => setLanguage('')} />}
              {minRating !== '0' && <FilterChip label={`Rating: ${minRating}+`} onRemove={() => setMinRating('0')} />}
              {featuredOnly && <FilterChip label="Featured partners" onRemove={() => setFeaturedOnly(false)} />}
              <button type="button"
                onClick={clearAllFilters}
                className="text-xs font-medium text-primary hover:underline"
              >
                Clear all
              </button>
            </div>
          )}
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
                {sortedBrokers.map((broker: any) => (
                  <BrokerGridCard
                    key={broker.id}
                    slug={broker.profileSlug}
                    name={broker.displayName || broker.companyName || 'Mortgage Broker'}
                    company={broker.companyName || 'Mortgage Broker'}
                    location={broker.serviceCities?.[0] || broker.city || 'United States'}
                    logo={broker.logo}
                    rating={broker.avgRating || 0}
                    reviewCount={broker.totalReviews || broker._count?.reviews || 0}
                    yearsExperience={broker.experienceYears || 0}
                    specializations={broker.specializations || []}
                    isVerified={broker.verificationStatus === 'VERIFIED'}
                    isFeatured={broker.isFeatured === true}
                    isPremium={false}
                    description={broker.description}
                    serviceCities={broker.serviceCities || []}
                    supportedBanks={(broker.bankPartners || []).map(
                      (bp: any) => bp.bankName
                    )}
                    languages={broker.languages || []}
                    phone={broker.canShowContact ? broker.phone : undefined}
                    email={broker.canShowContact ? broker.email : undefined}
                    viewMode={viewMode}
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

function FilterSelect({
  label,
  value,
  onChange,
  options,
  loading,
  disabled,
}: {
  label: string
  value: string
  onChange: (val: string) => void
  options: { value: string; label: string }[]
  loading?: boolean
  disabled?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium uppercase tracking-wide text-text-muted">
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || loading}
          className={cn(
            'w-full appearance-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-text-main',
            'transition-all focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15',
            (loading || disabled) && 'opacity-60',
          )}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
      </div>
      {loading && <p className="text-xs text-text-muted">Loading mortgage brokers...</p>}
    </div>
  )
}

function Select({
  value,
  onValueChange,
  options,
  triggerClassName,
}: {
  value: string
  onValueChange: (val: string) => void
  options: { value: string; label: string }[]
  triggerClassName?: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      className={cn(
        'w-full appearance-none border-0 bg-transparent text-sm font-medium outline-none',
        triggerClassName,
      )}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}

function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}) {
  const pages = Math.min(5, totalPages)
  return (
    <div className="mt-12 flex items-center justify-center gap-2">
      <button type="button"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="rounded-lg border border-border px-3.5 py-2 text-sm font-medium text-text-main transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
      >
        Previous
      </button>

      <div className="flex items-center gap-1">
        {Array.from({ length: pages }, (_, i) => {
          const pageNum = i + 1
          return (
            <button type="button"
              key={pageNum}
              onClick={() => onPageChange(pageNum)}
              className={cn(
                'h-9 w-9 rounded-lg border text-sm font-medium transition-colors',
                page === pageNum
                  ? 'border-primary bg-primary text-white'
                  : 'border-border text-text-main hover:bg-muted',
              )}
            >
              {pageNum}
            </button>
          )
        })}
        {totalPages > 5 && (
          <>
            <span className="px-1 text-sm text-text-muted">...</span>
            <button type="button"
              onClick={() => onPageChange(totalPages)}
              className={cn(
                'h-9 w-9 rounded-lg border text-sm font-medium transition-colors',
                page === totalPages
                  ? 'border-primary bg-primary text-white'
                  : 'border-border text-text-main hover:bg-muted',
              )}
            >
              {totalPages}
            </button>
          </>
        )}
      </div>

      <button type="button"
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="rounded-lg border border-border px-3.5 py-2 text-sm font-medium text-text-main transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
      >
        Next
      </button>
    </div>
  )
}
