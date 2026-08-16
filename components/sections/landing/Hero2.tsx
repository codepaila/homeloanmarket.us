'use client'
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, Home as HomeIcon, MapPin, Search, ShieldCheck, ArrowRight } from 'lucide-react'
import Image from 'next/image'
import { PremiumButton } from '@/components/design/PremiumButton'
import { fetchCities, fetchUSStates } from '@/lib/fetchClient'

const loanTypes = [
  { value: 'Home Purchase', label: 'Home Purchase' },
  { value: 'Refinance', label: 'Refinance' },
  { value: 'FHA Loan', label: 'FHA Loan' },
  { value: 'VA Loan', label: 'VA Loan' },
  { value: 'Jumbo Loan', label: 'Jumbo Loan' },
]

const loanAmounts = [
  { value: '', label: 'Any amount' },
  { value: '250000', label: 'Up to $250K' },
  { value: '500000', label: '$250K – $500K' },
  { value: '1000000', label: '$500K – $1M' },
  { value: '2000000', label: 'Above $1M' },
]

// Beautiful Unsplash background image
const heroBackground = 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1920&q=80'

type USStateOption = { code: string; name: string }

export default function HeroSection() {
  const router = useRouter()
  const prefersReducedMotion = useReducedMotion()
  const [query, setQuery] = useState('')
  const [loanType, setLoanType] = useState('Home Loan')
  const [state, setState] = useState('')
  const [states, setStates] = useState<USStateOption[]>([])
  const [city, setCity] = useState('')
  const [cityOptions, setCityOptions] = useState<string[]>([])
  const [citiesLoading, setCitiesLoading] = useState(false)
  const [amount, setAmount] = useState('')
  const [locationSuggestions, setLocationSuggestions] = useState<Array<{ placeId: string; label: string }>>([])
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1)
  const [searching, setSearching] = useState(false)
  const requestRef = useRef(0)
  const [selectedLocation, setSelectedLocation] = useState<{
    normalizedAddress: string
    city: string
    state: string
    zip: string
    latitude: number
    longitude: number
    token: string
  } | null>(null)

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
    if (!state) return
    setCitiesLoading(true)
    fetchCities(state)
      .then((data) => {
        if (mounted) setCityOptions(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        if (mounted) setCityOptions([])
      })
      .finally(() => {
        if (mounted) setCitiesLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [state])

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
    if (event.key === 'Enter' && activeSuggestionIndex >= 0 && locationSuggestions[activeSuggestionIndex]) {
      event.preventDefault()
      selectLocation(locationSuggestions[activeSuggestionIndex])
    }
  }

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault()
    const params = new URLSearchParams()
    const text = query.trim()
    let location = selectedLocation
    if (!location && /^\d{5}$/.test(text)) {
      try {
        const response = await fetch('/api/location/geocode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: `${text}, USA` }),
        })
        if (response.ok) {
          const data = await response.json()
          location = data.location
        }
      } catch {
        location = null
      }
    }
    if (location?.token) {
      params.set('location', location.normalizedAddress)
      params.set('radius', '25')
    } else if (text) params.set('search', text)
    else if (state) params.set('state', state)
    if (city) params.set('search', city)
    if (amount) params.set('loanAmount', amount)
    const queryString = params.toString()
    router.push(queryString ? `/brokers?${queryString}` : '/brokers')
  }

  const motionTransition = (delay: number) => ({
    duration: prefersReducedMotion ? 0 : 0.5,
    delay: prefersReducedMotion ? 0 : delay,
    ease: [0.25, 0.46, 0.45, 0.94] as const,
  })

  return (
    <section className="relative isolate min-h-[80vh] overflow-hidden bg-secondary">
      {/* Background Image */}
      <div className="absolute inset-0">
        <Image
          src={heroBackground}
          alt="Modern dream home"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
          aria-hidden="true"
        />
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-secondary/85 via-secondary/70 to-secondary/80" aria-hidden="true" />
        <div className="absolute inset-0 bg-gradient-to-t from-secondary/90 via-transparent to-secondary/30" aria-hidden="true" />
        
        {/* Decorative Glow Orbs */}
        <div className="absolute -right-20 -top-20 h-[400px] w-[400px] rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
        <div className="absolute -bottom-32 -left-32 h-[500px] w-[500px] rounded-full bg-accent/8 blur-3xl" aria-hidden="true" />
      </div>

      <div className="container-custom relative z-10">
        <div className="flex min-h-[80vh] items-center py-16 md:py-20 lg:py-24">
          <div className="mx-auto max-w-4xl text-center">
            {/* Trust Badge */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={motionTransition(0)}
              className="inline-flex items-center gap-2.5 rounded-full border border-primary/30 bg-secondary/40 px-5 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur-xl"
            >
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span className="bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
                America&apos;s trusted mortgage marketplace
              </span>
            </motion.div>

            {/* 5-Profile PNG Image */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={motionTransition(0.08)}
              className="mt-6 flex justify-center"
            >
              <Image
                src="/assets/images/5-profiles-cover-icon.png"
                alt="Verified mortgage professionals"
                width={600}
                height={150}
                priority
                className="h-auto w-full max-w-[600px] object-contain"
              />
            </motion.div>

            {/* Hero Heading */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={motionTransition(0.12)}
              className="mt-2 text-balance text-4xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl"
            >
              Find the right{' '}
              <span className="relative inline-block">
                <span className="relative z-10 bg-gradient-to-r from-primary via-emerald-300 to-primary bg-clip-text text-transparent">
                  mortgage broker
                </span>
                <span className="absolute -bottom-2 left-0 h-3 w-full bg-primary/20 blur-xl" aria-hidden="true" />
              </span>
              <br />
              <span className="text-white/90">for your dream home</span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={motionTransition(0.18)}
              className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-white/75 sm:text-lg"
            >
              Compare verified mortgage professionals, read real borrower reviews, 
              and connect with the right expert — all in one place.
            </motion.p>

            {/* Search Form */}
            <motion.form
              onSubmit={handleSearch}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={motionTransition(0.25)}
              className="mt-8 rounded-2xl border border-white/10 bg-white/95 p-3 shadow-2xl backdrop-blur-xl"
            >
              {/* Main Search Bar */}
              <div className="relative flex items-center gap-3 rounded-xl bg-white px-4 py-2.5 shadow-sm ring-1 ring-black/5 transition-all focus-within:ring-2 focus-within:ring-primary/50">
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
                <PremiumButton type="submit" size="md" className="shrink-0 bg-gradient-to-r from-primary to-emerald-600 px-6 shadow-md">
                  <span className="flex items-center">
                    Search
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </span>
                </PremiumButton>
              </div>

              {/* Filter Options - Fixed Icons */}
              <div className="mt-2.5 grid grid-cols-2 gap-1.5 border-t border-border/40 pt-2.5 md:grid-cols-4">
                {/* Loan Type */}
                <div className="group relative">
                  <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
                    <HomeIcon className="h-3.5 w-3.5 text-primary transition-transform group-hover:scale-110" />
                  </div>
                  <select
                    name="loanType"
                    value={loanType}
                    onChange={(event) => setLoanType(event.target.value)}
                    className="w-full appearance-none rounded-lg bg-muted/40 py-2 pl-8 pr-7 text-xs font-medium text-secondary transition-all hover:bg-muted/60 focus:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    aria-label="Loan type"
                  >
                    {loanTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-y-0.5" />
                  </div>
                </div>

                {/* State */}
                <div className="group relative">
                  <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
                    <MapPin className="h-3.5 w-3.5 text-primary transition-transform group-hover:scale-110" />
                  </div>
                  <select
                    name="state"
                    value={state}
                    onChange={(event) => {
                      const value = event.target.value
                      setCity('')
                      setCityOptions([])
                      setCitiesLoading(Boolean(value))
                      setState(value)
                    }}
                    className="w-full appearance-none rounded-lg bg-muted/40 py-2 pl-8 pr-7 text-xs font-medium text-secondary transition-all hover:bg-muted/60 focus:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    aria-label="State"
                  >
                    <option value="">All states</option>
                    {states.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-y-0.5" />
                  </div>
                </div>

                {/* City */}
                <div className="group relative">
                  <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
                    <MapPin className="h-3.5 w-3.5 text-primary transition-transform group-hover:scale-110" />
                  </div>
                  <select
                    name="city"
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                    disabled={!state || citiesLoading}
                    className="w-full appearance-none rounded-lg bg-muted/40 py-2 pl-8 pr-7 text-xs font-medium text-secondary transition-all hover:bg-muted/60 focus:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="City"
                  >
                    <option value="">
                      {state ? (citiesLoading ? 'Loading...' : 'All cities') : 'Select state'}
                    </option>
                    {cityOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-y-0.5" />
                  </div>
                </div>

                {/* Loan Amount */}
                <div className="group relative">
                  <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
                    <span className="text-xs font-bold text-primary">$</span>
                  </div>
                  <select
                    name="loanAmount"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    className="w-full appearance-none rounded-lg bg-muted/40 py-2 pl-8 pr-7 text-xs font-medium text-secondary transition-all hover:bg-muted/60 focus:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    aria-label="Loan amount"
                  >
                    {loanAmounts.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-y-0.5" />
                  </div>
                </div>
              </div>
            </motion.form>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={motionTransition(0.32)}
              className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
            >
              <Link href="/brokers" className="group">
                <PremiumButton
                  variant="primary"
                  size="lg"
                  className="relative overflow-hidden bg-gradient-to-r from-primary to-emerald-600 px-8 shadow-xl hover:shadow-2xl"
                >
                  <span className="relative z-10 flex items-center">
                    Find Mortgage Brokers
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                  <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
                </PremiumButton>
              </Link>
              <Link href="/subscription">
                <PremiumButton
                  variant="secondary"
                  size="lg"
                  className="border-white/30 bg-white/10 text-white backdrop-blur-md hover:bg-white/20"
                >
                  View Plans
                </PremiumButton>
              </Link>
            </motion.div>

            {/* Social Proof */}
            {/* <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={motionTransition(0.4)}
              className="mt-8 flex items-center justify-center gap-6"
            >
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, index) => (
                    <Star key={index} className="h-4 w-4 fill-yellow-400 text-yellow-400 drop-shadow-sm" />
                  ))}
                </div>
                <span className="text-sm font-semibold text-white">4.8/5</span>
                <span className="text-sm text-white/50">·</span>
                <span className="text-sm text-white/70">50K+ borrowers</span>
              </div>
            </motion.div> */}
          </div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      {/* <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" aria-hidden="true" /> */}
    </section>
  )
}
