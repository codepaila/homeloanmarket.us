"use client"
import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Home as HomeIcon, MapPin, Search, ArrowRight } from 'lucide-react'

import { PremiumButton } from '@/components/design/PremiumButton'
import { fetchCities, fetchUSStates } from '@/lib/fetchClient';
type USStateOption = { code: string; name: string }

function SearchSection() {
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
          if (locationSuggestions.length > 0) window.setTimeout(() => setLocationSuggestions([]), 0)
          return
        }
        const timer = window.setTimeout(() => {
          fetch(`/api/location/autocomplete?input=${encodeURIComponent(value)}`)
            .then((response) => response.json())
            .then((data) => setLocationSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []))
            .catch(() => setLocationSuggestions([]))
        }, 300)
        return () => window.clearTimeout(timer)
      }, [query, selectedLocation, locationSuggestions.length])
    
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
        } catch {
          setSelectedLocation(null)
          setLocationSuggestions([])
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
          params.set('locationToken', location.token)
          params.set('locationLabel', location.normalizedAddress)
          params.set('locationLatitude', String(location.latitude))
          params.set('locationLongitude', String(location.longitude))
          params.set('locationCity', location.city)
          params.set('locationState', location.state)
          params.set('locationZip', location.zip)
        } else if (text) params.set('q', text)
        else if (state && !city) params.set('q', state)
        if (city) params.set('city', city)
        if (loanType && loanType !== 'Home Loan') params.set('specialization', loanType)
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
    <div className="max-w-4xl mx-auto">

      <motion.form
                 onSubmit={handleSearch}
                 initial={{ opacity: 0, y: 20 }}
                 animate={{ opacity: 1, y: 0 }}
                 transition={motionTransition(0.25)}
                 className="my-8 "
                //  className="mt-8 rounded-2xl border border-white/10 bg-white/95 p-3 shadow backdrop-blur-xl"
               >
                 {/* Main Search Bar */}
                 <div className="relative flex items-center gap-3 rounded-xl bg-white px-4 py-2.5 shadow-sm ring-1 ring-black/5 transition-all focus-within:ring-2 focus-within:ring-primary/50">
                   <Search className="h-5 w-5 flex-shrink-0 text-primary" />
                   <input
                     type="search"
                     name="q"
                     value={query}
                     onChange={(event) => { setQuery(event.target.value); setSelectedLocation(null) }}
                     onKeyDown={(event) => { if (event.key === 'Escape') setLocationSuggestions([]) }}
                     placeholder="Search by broker, company, ZIP code, city, or state..."
                     className="flex-1 bg-transparent py-1 text-sm font-medium text-secondary placeholder:text-muted-foreground/70 focus:outline-none"
                     aria-label="Search brokers"
                   />
                   {locationSuggestions.length > 0 && (
                     <div className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-border bg-white shadow-xl" role="listbox" aria-label="Location suggestions">
                       {locationSuggestions.map((suggestion) => (
                         <button type="button" key={suggestion.placeId} role="option" aria-selected="false" onMouseDown={(event) => event.preventDefault()} onClick={() => selectLocation(suggestion)} className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-secondary hover:bg-muted focus:bg-muted focus:outline-none">
                           <MapPin className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                           {suggestion.label}
                         </button>
                       ))}
                     </div>
                   )}
                   <PremiumButton type="submit" size="md" className="shrink-0 bg-gradient-to-r from-primary to-emerald-600 px-6 shadow-md">
                     <span className="flex items-center">
                       Search
                       <ArrowRight className="ml-1.5 h-4 w-4" />
                     </span>
                   </PremiumButton>
                 </div>
   
               </motion.form>
    </div>
  )
}

export default SearchSection