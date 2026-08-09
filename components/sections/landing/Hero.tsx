'use client'

import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, Home as HomeIcon, MapPin, Search, ShieldCheck, Star } from 'lucide-react'
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

const quickStats = [
  { value: '10K+', label: 'Verified mortgage brokers' },
  { value: '$2.5B+', label: 'Loans funded' },
  { value: '< 24h', label: 'Avg. match time' },
]

const loanAmounts = [
  { value: '', label: 'Any amount' },
  { value: '250000', label: 'Up to $250K' },
  { value: '500000', label: '$250K – $500K' },
  { value: '1000000', label: '$500K – $1M' },
  { value: '2000000', label: 'Above $1M' },
]

const backgroundImage = 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=2400&h=1400&q=85'

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

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault()
    const params = new URLSearchParams()
    const text = query.trim()
    if (text) params.set('q', text)
    else if (state && !city) params.set('q', state)
    if (city) params.set('city', city)
    if (loanType && loanType !== 'Home Loan') params.set('specialization', loanType)
    if (amount) params.set('loanAmount', amount)
    const queryString = params.toString()
    router.push(queryString ? `/brokers?${queryString}` : '/brokers')
  }

  const motionTransition = (delay: number) => ({
    duration: prefersReducedMotion ? 0 : 0.45,
    delay: prefersReducedMotion ? 0 : delay,
  })

  return (
    <section className="relative isolate overflow-hidden bg-secondary">
      <Image
        src={backgroundImage}
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-secondary/65" aria-hidden="true" />

      <div className="container-custom relative z-10">
        <div className="grid items-center gap-10 py-12 md:py-16 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)] lg:gap-12 lg:py-20">
          <div className="max-w-xl">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={motionTransition(0)}
              className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur-sm"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              America&apos;s trusted mortgage marketplace
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={motionTransition(0.08)}
              className="mt-5 text-balance text-4xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-5xl xl:text-[3.4rem]"
            >
              Find the right mortgage broker,{' '}
              <span className="text-primary">quickly</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={motionTransition(0.16)}
              className="mt-5 text-lg leading-relaxed text-white/80"
            >
              Compare verified mortgage professionals, read real borrower reviews, and connect with the right mortgage expert — all in one place.
            </motion.p>

            <motion.form
              onSubmit={handleSearch}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={motionTransition(0.24)}
              className="mt-8 rounded-2xl border border-border bg-card p-2 text-card-foreground shadow-large"
            >
              <div className="flex items-center gap-2 rounded-xl px-3 py-1 transition-colors focus-within:bg-muted/40">
                <Search className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                <input
                  type="search"
                  name="q"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by broker, company, ZIP code, city, or state..."
                  className="w-full rounded-lg bg-transparent py-2 text-sm text-secondary outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/30"
                  aria-label="Search brokers"
                />
                <PremiumButton type="submit" className="shrink-0">Search Brokers</PremiumButton>
              </div>

              <div className="mt-2 grid grid-cols-1 gap-1.5 border-t border-border pt-2 sm:grid-cols-2 lg:grid-cols-4">
                <label className="relative flex items-center gap-2 rounded-xl px-3 py-2 transition-colors focus-within:bg-muted/40">
                  <HomeIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <select name="loanType" value={loanType} onChange={(event) => setLoanType(event.target.value)} className="w-full appearance-none bg-transparent text-sm font-medium text-secondary outline-none" aria-label="Loan type">
                    {loanTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 h-4 w-4 text-muted-foreground" />
                </label>

                <label className="relative flex items-center gap-2 rounded-xl px-3 py-2 transition-colors focus-within:bg-muted/40">
                  <MapPin className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <select name="state" value={state} onChange={(event) => { const value = event.target.value; setCity(''); setCityOptions([]); setCitiesLoading(Boolean(value)); setState(value) }} className="w-full appearance-none bg-transparent text-sm font-medium text-secondary outline-none" aria-label="State">
                    <option value="">All states</option>
                    {states.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 h-4 w-4 text-muted-foreground" />
                </label>

                <label className="relative flex items-center gap-2 rounded-xl px-3 py-2 transition-colors focus-within:bg-muted/40">
                  <MapPin className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <select
                    name="city"
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                    disabled={!state || citiesLoading}
                    className="w-full appearance-none bg-transparent text-sm font-medium text-secondary outline-none disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="City"
                  >
                    <option value="">{state ? (citiesLoading ? 'Loading cities...' : 'All cities') : 'Select state first'}</option>
                    {cityOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 h-4 w-4 text-muted-foreground" />
                </label>

                <label className="relative flex items-center gap-2 rounded-xl px-3 py-2 transition-colors focus-within:bg-muted/40">
                  <span className="text-sm font-medium text-muted-foreground">$</span>
                  <select name="loanAmount" value={amount} onChange={(event) => setAmount(event.target.value)} className="w-full appearance-none bg-transparent text-sm font-medium text-secondary outline-none" aria-label="Loan amount">
                    {loanAmounts.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 h-4 w-4 text-muted-foreground" />
                </label>
              </div>
            </motion.form>

            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={motionTransition(0.32)} className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link href="/brokers" className="sm:flex-1 lg:flex-none">
                <PremiumButton variant="primary" size="md" fullWidth className="sm:w-auto">Find Mortgage Brokers</PremiumButton>
              </Link>
              <Link href="/subscription" className="sm:flex-1 lg:flex-none">
                <PremiumButton variant="secondary" size="md" fullWidth className="sm:w-auto">View Subscription Plans</PremiumButton>
              </Link>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={motionTransition(0.4)} className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2.5">
                  {['RS', 'PK', 'AM', 'SV'].map((initials, index) => <span key={initials} className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-secondary bg-primary text-[10px] font-bold text-white" style={{ zIndex: 4 - index }}>{initials}</span>)}
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-secondary bg-white text-[10px] font-bold text-text-muted">50k+</span>
                </div>
                <div className="text-xs text-white/75">
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, index) => <Star key={index} className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />)}
                    <span className="ml-1 font-semibold text-white">4.8/5</span>
                  </div>
                  Trusted by 50,000+ borrowers
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={motionTransition(0.48)} className="mt-8 grid grid-cols-3 gap-4 border-t border-white/20 pt-6">
              {quickStats.map((stat) => <div key={stat.label}><div className="text-2xl font-extrabold text-white">{stat.value}</div><div className="mt-0.5 text-xs text-white/70">{stat.label}</div></div>)}
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={motionTransition(0.2)} className="relative mx-auto flex w-full max-w-xl items-center justify-center lg:justify-end">
            <Image
              src="/assets/images/5-profiles-cover-icon.png"
              alt="HomeLoanMarket mortgage professionals"
              width={830}
              height={215}
              priority
              className="h-auto w-full max-w-[620px] object-contain drop-shadow-[0_20px_30px_rgba(0,0,0,0.28)]"
            />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
