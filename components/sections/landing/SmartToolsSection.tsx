'use client'

import { motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'
import { ArrowRight, Calculator, Sparkles, Clock, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function SmartToolsSection() {
  const prefersReducedMotion = useReducedMotion()

  const motionTransition = (delay: number) => ({
    duration: prefersReducedMotion ? 0 : 0.6,
    delay: prefersReducedMotion ? 0 : delay,
    ease: [0.25, 0.46, 0.45, 0.94] as const,
  })

  const features = [
    {
      icon: Clock,
      title: 'Quick Estimates',
      description: 'Get instant monthly payment estimates in seconds',
    },
    {
      icon: Shield,
      title: 'Accurate Calculations',
      description: 'Built with industry-standard formulas you can trust',
    },
    {
      icon: Sparkles,
      title: 'Smart Insights',
      description: 'Understand your affordability at a glance',
    },
  ]

  return (
    <section className="section-spacing bg-bg-deep">
      <div className="container-custom">
        <div className="grid gap-12 lg:grid-cols-5 lg:items-center lg:gap-16">

          {/* Supporting column (~38%) */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={motionTransition(0)}
              className="inline-flex items-center gap-2 rounded border border-border bg-card px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground"
            >
              <Calculator className="h-3.5 w-3.5 text-foreground" />
              <span>Smart Tool</span>
            </motion.div>

            {/* Main Heading */}
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={motionTransition(0.1)}
              className="heading-3 mt-5 text-foreground"
            >
              Monthly Payment Calculator
            </motion.h2>

            {/* Description */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={motionTransition(0.2)}
              className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg"
            >
              Estimate your monthly mortgage payments instantly. Plan your home financing
              journey with confidence and clarity.
            </motion.p>

            {/* Supporting feature list */}
            <motion.ul
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={motionTransition(0.3)}
              className="mt-10 space-y-5 border-t border-border pt-8"
            >
              {features.map((feature) => (
                <li key={feature.title} className="flex items-start gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground">
                    <feature.icon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-foreground">{feature.title}</span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">{feature.description}</span>
                  </span>
                </li>
              ))}
            </motion.ul>
          </div>

          {/* Calculator card — focal point (~62%) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={motionTransition(0.25)}
            className="lg:col-span-3"
          >
            <div className="card card-hover-accent group p-8 sm:p-10 lg:p-12">
              <div className="flex items-center gap-3 border-b border-border pb-6">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Calculator className="h-5 w-5" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Mortgage Tool
                </span>
              </div>

              <h3 className="mt-8 text-xl font-semibold text-foreground sm:text-2xl">
                Calculate Your Monthly Payment
              </h3>

              <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
                Enter loan amount, interest rate, and term to see your monthly payment
              </p>

              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <Link href="/calculator">
                  <Button
                    className="btn-primary w-full px-8 py-3 text-base sm:w-auto"
                  >
                    <span className="flex items-center gap-2">
                      Start Calculating
                      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </span>
                  </Button>
                </Link>
              </div>

              {/* Quick Stats */}
              <div className="mt-10 grid grid-cols-3 gap-4 border-t border-border pt-6">
                <div>
                  <p className="text-xs text-muted-foreground">Loan Amount</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">$100k - $5M</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Terms</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">10 - 30 Years</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Rate</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">1% - 15%</p>
                </div>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  )
}
