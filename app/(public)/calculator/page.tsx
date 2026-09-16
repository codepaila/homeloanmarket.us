'use client'

/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useMemo, useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { Calculator, Home, Percent, Calendar } from 'lucide-react'
import { AnimatedContainer } from '@/components/design/AnimatedContainer'
import { Section } from '@/components/design/Section'
import { cn } from '@/lib/utils'

/**
 * Smoothly tweens a number toward `target` whenever it changes, so the
 * summary panel visibly responds to slider movement instead of jumping.
 */
function useAnimatedNumber(target: number, duration = 400) {
  const [value, setValue] = useState(target)
  const fromRef = useRef(target)
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    const from = fromRef.current
    const to = target
    if (from === to) return

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (prefersReducedMotion) {
      fromRef.current = to
      setValue(to)
      return
    }

    const start = performance.now()
    if (frameRef.current) cancelAnimationFrame(frameRef.current)

    const tick = (now: number) => {
      const elapsed = now - start
      const t = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(from + (to - from) * eased)
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = to
      }
    }
    frameRef.current = requestAnimationFrame(tick)
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [target, duration])

  return value
}

/**
 * Backs a numeric slider with a free-typing text field. The field keeps
 * its own text state that only re-syncs from the numeric value while the
 * field is NOT focused — so clearing the box and retyping never gets
 * fought by a re-render that snaps it back to a clamped default.
 * Clamping only happens once, on blur.
 */
function useEditableNumber({
  value,
  setValue,
  min,
  max,
  decimals = 0,
}: {
  value: number
  setValue: (n: number) => void
  min: number
  max: number
  decimals?: number
}) {
  const format = (v: number) =>
    decimals > 0 ? v.toFixed(decimals) : Math.round(v).toLocaleString('en-US')

  const [text, setText] = useState(() => format(value))
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    if (!isEditing) setText(format(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, isEditing])

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const allowed = decimals > 0 ? /[^0-9.]/g : /[^0-9]/g
    let cleaned = e.target.value.replace(allowed, '')
    if (decimals > 0) {
      const parts = cleaned.split('.')
      if (parts.length > 2) cleaned = parts[0] + '.' + parts.slice(1).join('')
    }
    setText(cleaned)
    if (cleaned !== '' && cleaned !== '.') {
      const parsed = parseFloat(cleaned)
      if (Number.isFinite(parsed)) setValue(parsed)
    }
  }

  const onFocus = () => {
    setIsEditing(true)
    setText(value ? String(value) : '')
  }

  const onBlur = () => {
    const parsed = parseFloat(text)
    const clamped = Math.min(max, Math.max(min, Number.isFinite(parsed) ? parsed : min))
    setValue(clamped)
    setText(format(clamped))
    setIsEditing(false)
  }

  return { text, onChange, onFocus, onBlur }
}

export const MIN_HOME_PRICE = 100000
export const MAX_HOME_PRICE = 5000000
export const MIN_DOWN_PAYMENT = 0
export const MAX_DOWN_PAYMENT = 50
export const MIN_INTEREST_RATE = 1
export const MAX_INTEREST_RATE = 15
export const MIN_LOAN_TERM = 1
export const MAX_LOAN_TERM = 50
export const DEFAULT_HOME_PRICE = 300000
export const DEFAULT_DOWN_PAYMENT = 20
export const DEFAULT_INTEREST_RATE = 6.5
export const DEFAULT_LOAN_TERM = 30
export const LOAN_TERM_PRESETS = [15, 20, 30] as const

export function clampLoanTerm(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_LOAN_TERM
  return Math.min(MAX_LOAN_TERM, Math.max(MIN_LOAN_TERM, Math.round(value)))
}

export type MortgageInputs = {
  homePrice: number
  downPaymentPercent: number
  interestRate: number
  loanTerm: number
}

export type MortgageResults = {
  downPaymentAmount: number
  loanAmount: number
  monthlyPayment: number
  totalPayment: number
  totalInterest: number
  interestShare: number
  principalShare: number
}

// Pure calculation boundary. Guards every input so an invalid/transient value
// (e.g. an interest rate of 0 typed mid-edit) can never surface NaN or
// Infinity to the UI. The amortization formula is unchanged.
export function calculateMortgage({
  homePrice,
  downPaymentPercent,
  interestRate,
  loanTerm,
}: MortgageInputs): MortgageResults {
  const finite = (value: number) => (Number.isFinite(value) ? value : 0)

  const safeHomePrice = Number.isFinite(homePrice) && homePrice > 0 ? homePrice : 0
  const safeDownPercent = Number.isFinite(downPaymentPercent)
    ? Math.min(100, Math.max(0, downPaymentPercent))
    : 0

  const downPaymentAmount = safeHomePrice * (safeDownPercent / 100)
  const loanAmount = Math.max(0, safeHomePrice - downPaymentAmount)

  const safeRate = Number.isFinite(interestRate) && interestRate > 0 ? interestRate : 0
  const monthlyRate = safeRate / 100 / 12
  const numberOfPayments = clampLoanTerm(loanTerm) * 12

  let monthlyPayment = 0
  if (loanAmount > 0 && numberOfPayments > 0) {
    if (monthlyRate > 0) {
      const growth = Math.pow(1 + monthlyRate, numberOfPayments)
      monthlyPayment = (loanAmount * (monthlyRate * growth)) / (growth - 1)
    } else {
      monthlyPayment = loanAmount / numberOfPayments
    }
  }

  monthlyPayment = finite(monthlyPayment)
  const totalPayment = finite(monthlyPayment * numberOfPayments)
  const totalInterest = finite(totalPayment - loanAmount)
  const interestShare = totalPayment > 0 ? (totalInterest / totalPayment) * 100 : 0
  const principalShare = 100 - interestShare

  return {
    downPaymentAmount,
    loanAmount,
    monthlyPayment,
    totalPayment,
    totalInterest,
    interestShare,
    principalShare,
  }
}

export default function CalculatorPage() {
  const [homePrice, setHomePrice] = useState(DEFAULT_HOME_PRICE)
  const [interestRate, setInterestRate] = useState(DEFAULT_INTEREST_RATE)
  const [downPayment, setDownPayment] = useState(DEFAULT_DOWN_PAYMENT)
  const [termPreset, setTermPreset] = useState<number | 'other'>(DEFAULT_LOAN_TERM)
  const [customTerm, setCustomTerm] = useState(25)
  const customTermInputRef = useRef<HTMLInputElement>(null)

  const homePriceField = useEditableNumber({
    value: homePrice,
    setValue: setHomePrice,
    min: MIN_HOME_PRICE,
    max: MAX_HOME_PRICE,
  })
  const downPaymentField = useEditableNumber({
    value: downPayment,
    setValue: setDownPayment,
    min: MIN_DOWN_PAYMENT,
    max: MAX_DOWN_PAYMENT,
  })
  const interestRateField = useEditableNumber({
    value: interestRate,
    setValue: setInterestRate,
    min: MIN_INTEREST_RATE,
    max: MAX_INTEREST_RATE,
    decimals: 1,
  })
  const customTermField = useEditableNumber({
    value: customTerm,
    setValue: setCustomTerm,
    min: MIN_LOAN_TERM,
    max: MAX_LOAN_TERM,
  })

  // A preset always wins; a custom term only applies while "Other" is selected,
  // so stale custom state can never override 15/20/30.
  const effectiveLoanTerm = termPreset === 'other' ? clampLoanTerm(customTerm) : termPreset
  const customTermInvalid =
    termPreset === 'other' &&
    (!Number.isFinite(customTerm) ||
      !Number.isInteger(customTerm) ||
      customTerm < MIN_LOAN_TERM ||
      customTerm > MAX_LOAN_TERM)

  useEffect(() => {
    if (termPreset === 'other') customTermInputRef.current?.focus()
  }, [termPreset])

  const results = useMemo(
    () =>
      calculateMortgage({
        homePrice,
        downPaymentPercent: downPayment,
        interestRate,
        loanTerm: effectiveLoanTerm,
      }),
    [homePrice, downPayment, interestRate, effectiveLoanTerm],
  )

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number.isFinite(value) ? value : 0)
  }

  const formatCompact = (value: number) => {
    if (value >= 1_000_000) {
      const millions = value / 1_000_000
      return `$${millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1)}M`
    }
    return `$${Math.round(value / 1000)}K`
  }

  const animatedMonthly = useAnimatedNumber(results.monthlyPayment)
  const animatedLoanAmount = useAnimatedNumber(results.loanAmount)
  const animatedDownPayment = useAnimatedNumber(results.downPaymentAmount)
  const animatedTotal = useAnimatedNumber(results.totalPayment)
  const animatedPrincipalShare = useAnimatedNumber(results.principalShare)
  const animatedInterestShare = useAnimatedNumber(results.interestShare)

  const sliderStyle = { accentColor: 'var(--foreground)' } as const
  const fieldInputClass =
    'rounded-md border border-border bg-background/50 py-1.5 text-right text-sm font-semibold text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20'

  return (
    <div className="min-h-screen">
      <Section className="bg-muted">
        <AnimatedContainer>
          <div className="text-center max-w-2xl mx-auto">
            <Calculator className="h-9 w-9 text-primary mx-auto mb-3" />
            <h1 className="heading-2 text-foreground mb-2">Mortgage calculator</h1>
            <p className="text-base text-muted-foreground max-w-xl mx-auto">
              See your monthly payment and how much goes to interest.
            </p>
          </div>
        </AnimatedContainer>
      </Section>

      <Section className="bg-background">
        <AnimatedContainer>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl mx-auto rounded-sm border border-border bg-card overflow-hidden shadow-soft"
          >
            <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
              {/* Inputs */}
              <div className="p-5 sm:p-6 space-y-5">
                <h2 className="text-base font-semibold text-foreground">Loan details</h2>

                {/* Home price */}
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <label htmlFor="homePrice" className="text-sm font-medium text-foreground">
                        Home price
                      </label>
                      <p className="text-[11px] leading-tight text-muted-foreground">
                        The purchase price of the home.
                      </p>
                    </div>
                    <div className="relative shrink-0">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        $
                      </span>
                      <input
                        id="homePrice"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={homePriceField.text}
                        onChange={homePriceField.onChange}
                        onFocus={homePriceField.onFocus}
                        onBlur={homePriceField.onBlur}
                        className={cn(fieldInputClass, 'w-28 pl-5 pr-2')}
                      />
                    </div>
                  </div>
                  <input
                    type="range"
                    min={MIN_HOME_PRICE}
                    max={MAX_HOME_PRICE}
                    step="5000"
                    value={Math.min(MAX_HOME_PRICE, Math.max(MIN_HOME_PRICE, homePrice || MIN_HOME_PRICE))}
                    onChange={(e) => setHomePrice(parseInt(e.target.value))}
                    aria-label="Home price"
                    style={sliderStyle}
                    className="w-full h-1.5 bg-muted rounded-full cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>{formatCompact(MIN_HOME_PRICE)}</span>
                    <span>{formatCompact(MAX_HOME_PRICE)}</span>
                  </div>
                </div>

                {/* Down payment */}
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <label htmlFor="downPayment" className="text-sm font-medium text-foreground">
                        Down payment
                      </label>
                      <p className="text-[11px] leading-tight text-muted-foreground">
                        Paid upfront — lowers what you finance.
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <div className="relative">
                        <input
                          id="downPayment"
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={downPaymentField.text}
                          onChange={downPaymentField.onChange}
                          onFocus={downPaymentField.onFocus}
                          onBlur={downPaymentField.onBlur}
                          className={cn(fieldInputClass, 'w-16 pl-2 pr-5')}
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          %
                        </span>
                      </div>
                      <span className="text-xs font-medium text-foreground tabular-nums whitespace-nowrap">
                        ({formatCurrency(results.downPaymentAmount)})
                      </span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="1"
                    value={downPayment}
                    onChange={(e) => setDownPayment(parseInt(e.target.value))}
                    aria-label="Down payment percentage"
                    style={sliderStyle}
                    className="w-full h-1.5 bg-muted rounded-full cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>0%</span>
                    <span>{formatCurrency(results.downPaymentAmount)}</span>
                    <span>50%</span>
                  </div>
                </div>

                {/* Loan amount (derived) */}
                <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-foreground">Loan amount</span>
                    <span className="text-sm font-semibold text-foreground tabular-nums">
                      {formatCurrency(animatedLoanAmount)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
                    Home price − down payment.
                  </p>
                </div>

                {/* Loan term */}
                <div className="space-y-1.5">
                  <span id="loanTermLabel" className="text-sm font-medium text-foreground">Loan term</span>
                  <div role="group" aria-labelledby="loanTermLabel" className="grid grid-cols-4 gap-1.5">
                    {LOAN_TERM_PRESETS.map((term) => (
                      <button
                        key={term}
                        type="button"
                        onClick={() => setTermPreset(term)}
                        aria-pressed={termPreset === term}
                        className={cn(
                          'relative py-1.5 rounded-md text-xs font-medium transition-colors duration-150',
                          termPreset === term ? '' : 'bg-muted text-foreground hover:bg-border/60'
                        )}
                      >
                        {termPreset === term && (
                          <motion.span
                            layoutId="activeTerm"
                            className="absolute inset-0 rounded-md bg-primary"
                            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                          />
                        )}
                        <span
                          className={cn(
                            'relative z-10',
                            termPreset === term ? 'text-primary-foreground' : ''
                          )}
                        >
                          {term} yr
                        </span>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setTermPreset('other')}
                      aria-pressed={termPreset === 'other'}
                      className={cn(
                        'relative py-1.5 rounded-md text-xs font-medium transition-colors duration-150',
                        termPreset === 'other' ? '' : 'bg-muted text-foreground hover:bg-border/60'
                      )}
                    >
                      {termPreset === 'other' && (
                        <motion.span
                          layoutId="activeTerm"
                          className="absolute inset-0 rounded-md bg-primary"
                          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        />
                      )}
                      <span
                        className={cn(
                          'relative z-10',
                          termPreset === 'other' ? 'text-primary-foreground' : ''
                        )}
                      >
                        Other
                      </span>
                    </button>
                  </div>

                  {termPreset === 'other' && (
                    <div className="pt-1">
                      <label htmlFor="customLoanTerm" className="text-xs font-medium text-foreground">
                        Custom loan term
                      </label>
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          id="customLoanTerm"
                          ref={customTermInputRef}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={customTermField.text}
                          onChange={customTermField.onChange}
                          onFocus={customTermField.onFocus}
                          onBlur={customTermField.onBlur}
                          aria-invalid={customTermInvalid}
                          aria-describedby={customTermInvalid ? 'customLoanTermError' : undefined}
                          className={cn(fieldInputClass, 'w-16 pl-2 pr-2')}
                        />
                        <span className="text-xs text-muted-foreground">years</span>
                      </div>
                      {customTermInvalid && (
                        <p id="customLoanTermError" role="alert" className="mt-1 text-xs text-destructive">
                          Enter a whole number of years between {MIN_LOAN_TERM} and {MAX_LOAN_TERM}.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Interest rate */}
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <label htmlFor="interestRate" className="text-sm font-medium text-foreground">
                        Interest rate
                      </label>
                      <p className="text-[11px] leading-tight text-muted-foreground">
                        Annual rate charged by your lender.
                      </p>
                    </div>
                    <div className="relative shrink-0">
                      <input
                        id="interestRate"
                        type="text"
                        inputMode="decimal"
                        value={interestRateField.text}
                        onChange={interestRateField.onChange}
                        onFocus={interestRateField.onFocus}
                        onBlur={interestRateField.onBlur}
                        className={cn(fieldInputClass, 'w-16 pl-2 pr-5')}
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        %
                      </span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="15"
                    step="0.1"
                    value={interestRate}
                    onChange={(e) => setInterestRate(parseFloat(e.target.value))}
                    aria-label="Interest rate"
                    style={sliderStyle}
                    className="w-full h-1.5 bg-muted rounded-full cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>1%</span>
                    <span>15%</span>
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="p-5 sm:p-6 bg-muted space-y-5">
                <h2 className="text-base font-semibold text-foreground">Payment summary</h2>

                <div className="text-center">
                  <div className="text-3xl sm:text-4xl font-bold text-foreground tabular-nums">
                    {formatCurrency(animatedMonthly)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">per month</p>
                </div>

                {/* Composition bar */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">
                    Where payments go over {effectiveLoanTerm} years
                  </p>
                  <div className="flex h-2.5 w-full overflow-hidden rounded-full border border-border">
                    <div
                      className="h-full bg-foreground transition-[width] duration-500 ease-out"
                      style={{ width: `${animatedPrincipalShare}%` }}
                      aria-label={`Loan amount ${results.principalShare.toFixed(0)}%`}
                    />
                    <div
                      className="h-full bg-foreground/20 transition-[width] duration-500 ease-out"
                      style={{ width: `${animatedInterestShare}%` }}
                      aria-label={`Interest ${results.interestShare.toFixed(0)}%`}
                    />
                  </div>
                  <div className="flex justify-between mt-1.5 text-[11px]">
                    <span className="flex items-center gap-1 text-foreground">
                      <span className="h-1.5 w-1.5 rounded-sm bg-foreground" />
                      Loan amount {results.principalShare.toFixed(0)}%
                    </span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <span className="h-1.5 w-1.5 rounded-sm bg-foreground/20" />
                      Interest {results.interestShare.toFixed(0)}%
                    </span>
                  </div>
                </div>

                {/* Breakdown */}
                <dl className="text-sm">
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <dt className="text-muted-foreground flex items-center gap-1.5 text-xs">
                      <Home className="h-3.5 w-3.5" />
                      Loan amount
                    </dt>
                    <dd className="font-semibold text-foreground tabular-nums text-sm">
                      {formatCurrency(animatedLoanAmount)}
                    </dd>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <dt className="text-muted-foreground flex items-center gap-1.5 text-xs">
                      <Percent className="h-3.5 w-3.5" />
                      Down payment
                    </dt>
                    <dd className="font-semibold text-foreground tabular-nums text-sm">
                      {formatCurrency(animatedDownPayment)}
                    </dd>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <dt className="text-foreground font-medium flex items-center gap-1.5 text-xs">
                      <Calendar className="h-3.5 w-3.5" />
                      Total of all payments
                    </dt>
                    <dd className="text-sm font-bold text-foreground tabular-nums">
                      {formatCurrency(animatedTotal)}
                    </dd>
                  </div>
                </dl>

                <p className="text-[11px] text-muted-foreground text-center">
                  Estimate only. Actual terms vary by credit, location, and lender.
                </p>
              </div>
            </div>
          </motion.div>
        </AnimatedContainer>
      </Section>
    </div>
  )
}
