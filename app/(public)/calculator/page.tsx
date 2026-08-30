'use client'

import { useState, useMemo } from 'react'
import { motion } from 'motion/react'
import { Calculator, Home, DollarSign, Percent, Calendar, TrendingUp } from 'lucide-react'
import { AnimatedContainer } from '@/components/design/AnimatedContainer'
import { Section } from '@/components/design/Section'
import { StatCard } from '@/components/design/StatCard'
import { cn } from '@/lib/utils'

export default function CalculatorPage() {
  const [loanAmount, setLoanAmount] = useState(300000)
  const [interestRate, setInterestRate] = useState(6.5)
  const [loanTerm, setLoanTerm] = useState(30)
  const [downPayment, setDownPayment] = useState(20)

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

    return {
      principal,
      monthlyPayment,
      totalPayment,
      totalInterest,
      downPaymentAmount,
    }
  }, [loanAmount, interestRate, loanTerm, downPayment])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const inputClass = 'border-border bg-background/50 focus:border-primary focus:ring-primary/15'

  return (
    <div className="min-h-screen">
        <Section className="bg-muted">
        <AnimatedContainer>
          <div className="text-center max-w-3xl mx-auto">
            <Calculator className="h-12 w-12 text-primary mx-auto mb-4" />
            <h1 className="heading-1 text-foreground mb-4">
              Mortgage Calculator
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Calculate your potential mortgage repayments and understand your borrowing power
              with our easy-to-use calculator.
            </p>
          </div>
        </AnimatedContainer>
      </Section>

      <Section className="bg-background">
        <AnimatedContainer>
          <div className="grid lg:grid-cols-2 gap-8">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="card card-hover"
            >
              <div className="p-8">
                <h2 className="text-2xl font-bold text-foreground mb-6">Calculate Your Payment</h2>

                <div className="space-y-8">
                  <div className="space-y-4">
                    <label className="flex items-center justify-between text-sm font-medium text-foreground">
                      <span>Loan Amount</span>
                      <span className="text-primary">{formatCurrency(loanAmount)}</span>
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <input
                        type="range"
                        min="50000"
                        max="2000000"
                        step="10000"
                        value={loanAmount}
                        onChange={(e) => setLoanAmount(parseInt(e.target.value))}
                        className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                    <input
                      type="number"
                      value={loanAmount}
                      onChange={(e) => {
                        const value = parseInt(e.target.value, 10)
                        setLoanAmount(Number.isFinite(value) ? Math.min(2000000, Math.max(50000, value)) : 50000)
                      }}
                      min="50000"
                      max="2000000"
                      className={cn('input', inputClass, 'pl-10')}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>$50K</span>
                      <span>$500K</span>
                      <span>$1M</span>
                      <span>$2M</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="flex items-center justify-between text-sm font-medium text-foreground">
                      <span>Down Payment</span>
                      <span className="text-secondary">{downPayment}%</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="50"
                      step="1"
                      value={downPayment}
                      onChange={(e) => setDownPayment(parseInt(e.target.value))}
                      className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>0%</span>
                      <span>10%</span>
                      <span>20%</span>
                      <span>30%</span>
                      <span>40%</span>
                      <span>50%</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="flex items-center justify-between text-sm font-medium text-foreground">
                      <span>Interest Rate</span>
                      <span className="text-primary">{interestRate}%</span>
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="15"
                      step="0.1"
                      value={interestRate}
                      onChange={(e) => setInterestRate(parseFloat(e.target.value))}
                      className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>1%</span>
                      <span>5%</span>
                      <span>10%</span>
                      <span>15%</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-sm font-medium text-foreground">Loan Term</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[10, 15, 20, 30].map((term) => (
                        <button
                          key={term}
                          type="button"
                          onClick={() => setLoanTerm(term)}
                          className={cn(
                            'py-2 rounded-xl text-sm font-medium transition-all duration-200',
                            loanTerm === term
                              ? 'bg-primary text-white shadow-medium'
                              : 'bg-muted text-foreground hover:bg-primary/10 hover:text-primary'
                          )}
                        >
                          {term} years
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="card bg-muted"
            >
              <div className="p-8">
                <h2 className="text-2xl font-bold text-foreground mb-8">Payment Summary</h2>

                <div className="text-center mb-8">
                  <div className="text-4xl md:text-5xl font-bold text-foreground mb-2">
                    {formatCurrency(results.monthlyPayment)}
                  </div>
                  <p className="text-muted-foreground">Monthly Payment</p>
                </div>

                <div className="space-y-4 mb-8">
                  <div className="flex justify-between items-center p-4 bg-muted/30 rounded-xl">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Home className="h-4 w-4" />
                      Loan Amount
                    </span>
                    <span className="text-xl font-bold text-primary">
                      {formatCurrency(results.principal)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-muted/30 rounded-xl">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Percent className="h-4 w-4" />
                      Down Payment ({downPayment}%)
                    </span>
                    <span className="text-xl font-bold text-secondary">
                      {formatCurrency(results.downPaymentAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-muted/30 rounded-xl">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Total Interest Paid
                    </span>
                    <span className="text-xl font-bold text-accent">
                      {formatCurrency(results.totalInterest)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-muted/50 rounded-xl border border-primary/20">
                    <span className="text-foreground font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Total Payment
                    </span>
                    <span className="text-xl font-bold text-primary">
                      {formatCurrency(results.totalPayment)}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  Results are estimates. Actual terms may vary based on credit score,
                  location, and other factors.
                </p>
              </div>
            </motion.div>
          </div>
        </AnimatedContainer>

      </Section>
    </div>
  )
}
