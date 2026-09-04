'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { Calculator, Home, Percent, Calendar, TrendingUp } from 'lucide-react'
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

const MIN_LOAN = 50000
const MAX_LOAN = 500000

export default function CalculatorPage() {
  const [loanAmount, setLoanAmount] = useState(300000)
  const [interestRate, setInterestRate] = useState(6.5)
  const [loanTerm, setLoanTerm] = useState(7)
  const [downPayment, setDownPayment] = useState(20)

  const loanAmountField = useEditableNumber({
    value: loanAmount,
    setValue: setLoanAmount,
    min: MIN_LOAN,
    max: MAX_LOAN,
  })
  const downPaymentField = useEditableNumber({
    value: downPayment,
    setValue: setDownPayment,
    min: 0,
    max: 50,
  })
  const interestRateField = useEditableNumber({
    value: interestRate,
    setValue: setInterestRate,
    min: 1,
    max: 15,
    decimals: 1,
  })

  const results = useMemo(() => {
    const principal = loanAmount * (1 - downPayment / 100)
    const monthlyRate = interestRate / 100 / 12
    const numberOfPayments = loanTerm * 12

    const monthlyPayment =
      principal *
      (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) /
      (Math.pow(1 + monthlyRate, numberOfPayments) - 1)

    const totalPayment = monthlyPayment * numberOfPayments
    const totalInterest = totalPayment - principal
    const downPaymentAmount = loanAmount * (downPayment / 100)

    const interestShare = totalPayment > 0 ? (totalInterest / totalPayment) * 100 : 0
    const principalShare = 100 - interestShare

    return {
      principal,
      monthlyPayment,
      totalPayment,
      totalInterest,
      downPaymentAmount,
      interestShare,
      principalShare,
    }
  }, [loanAmount, interestRate, loanTerm, downPayment])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number.isFinite(value) ? value : 0)
  }

  const formatCompact = (value: number) => `$${Math.round(value / 1000)}K`

  const animatedMonthly = useAnimatedNumber(results.monthlyPayment)
  const animatedPrincipal = useAnimatedNumber(results.principal)
  const animatedDownPayment = useAnimatedNumber(results.downPaymentAmount)
  const animatedInterest = useAnimatedNumber(results.totalInterest)
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

                {/* Loan amount */}
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <label htmlFor="loanAmount" className="text-sm font-medium text-foreground">
                        Loan amount
                      </label>
                      <p className="text-[11px] leading-tight text-muted-foreground">
                        Total you&apos;re borrowing, before interest.
                      </p>
                    </div>
                    <div className="relative shrink-0">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        $
                      </span>
                      <input
                        id="loanAmount"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={loanAmountField.text}
                        onChange={loanAmountField.onChange}
                        onFocus={loanAmountField.onFocus}
                        onBlur={loanAmountField.onBlur}
                        className={cn(fieldInputClass, 'w-28 pl-5 pr-2')}
                      />
                    </div>
                  </div>
                  <input
                    type="range"
                    min={MIN_LOAN}
                    max={MAX_LOAN}
                    step="5000"
                    value={Math.min(MAX_LOAN, Math.max(MIN_LOAN, loanAmount || MIN_LOAN))}
                    onChange={(e) => setLoanAmount(parseInt(e.target.value))}
                    style={sliderStyle}
                    className="w-full h-1.5 bg-muted rounded-full cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>{formatCompact(MIN_LOAN)}</span>
                    <span>{formatCompact(MAX_LOAN)}</span>
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
                    <div className="relative shrink-0">
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
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="1"
                    value={downPayment}
                    onChange={(e) => setDownPayment(parseInt(e.target.value))}
                    style={sliderStyle}
                    className="w-full h-1.5 bg-muted rounded-full cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>0%</span>
                    <span>{formatCurrency(results.downPaymentAmount)}</span>
                    <span>50%</span>
                  </div>
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
                    style={sliderStyle}
                    className="w-full h-1.5 bg-muted rounded-full cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>1%</span>
                    <span>15%</span>
                  </div>
                </div>

                {/* Loan term */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Loan term</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[3, 5, 7, 10].map((term) => (
                      <button
                        key={term}
                        type="button"
                        onClick={() => setLoanTerm(term)}
                        aria-pressed={loanTerm === term}
                        className={cn(
                          'relative py-1.5 rounded-md text-xs font-medium transition-colors duration-150',
                          loanTerm === term ? '' : 'bg-muted text-foreground hover:bg-border/60'
                        )}
                      >
                        {loanTerm === term && (
                          <motion.span
                            layoutId="activeTerm"
                            className="absolute inset-0 rounded-md bg-primary"
                            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                          />
                        )}
                        <span
                          className={cn(
                            'relative z-10',
                            loanTerm === term ? 'text-primary-foreground' : ''
                          )}
                        >
                          {term} yr
                        </span>
                      </button>
                    ))}
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
                    Where payments go over {loanTerm} years
                  </p>
                  <div className="flex h-2.5 w-full overflow-hidden rounded-full border border-border">
                    <div
                      className="h-full bg-foreground transition-[width] duration-500 ease-out"
                      style={{ width: `${animatedPrincipalShare}%` }}
                      aria-label={`Principal ${results.principalShare.toFixed(0)}%`}
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
                      Principal {results.principalShare.toFixed(0)}%
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
                      Principal
                    </dt>
                    <dd className="font-semibold text-foreground tabular-nums text-sm">
                      {formatCurrency(animatedPrincipal)}
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
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <dt className="text-muted-foreground flex items-center gap-1.5 text-xs">
                      <TrendingUp className="h-3.5 w-3.5" />
                      Total interest
                    </dt>
                    <dd className="font-semibold text-foreground tabular-nums text-sm">
                      {formatCurrency(animatedInterest)}
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