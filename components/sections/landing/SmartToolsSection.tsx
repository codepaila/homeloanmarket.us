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
    <section className="section-spacing bg-white">
      <div className="container-custom">
        <div className="mx-auto max-w-4xl text-center">
          {/* Section Badge */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={motionTransition(0)}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground"
          >
            <Calculator className="h-3.5 w-3.5 text-foreground" />
            <span>Smart Tool</span>
          </motion.div>

          {/* Main Heading */}
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={motionTransition(0.1)}
            className="mt-4 text-3xl font-bold text-foreground sm:text-4xl md:text-5xl"
          >
            <span className="text-foreground">
              Monthly Payment Calculator
            </span>
            {/* <span className="text-muted-foreground"></span> */}
          </motion.h2>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={motionTransition(0.2)}
            className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
            Estimate your monthly mortgage payments instantly. Plan your home financing
            journey with confidence and clarity.
          </motion.p>

          {/* Main Calculator Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={motionTransition(0.25)}
            className="mt-10 mx-auto max-w-lg"
          >
            <div className="card card-hover-accent p-8 text-center">
              {/* Large Icon */}
              <div className="mb-6 flex justify-center">
                <div className="rounded-full bg-surface p-5 transition-colors group-hover:bg-foreground">
                  <Calculator className="h-10 w-10 text-foreground transition-colors group-hover:text-background" />
                </div>
              </div>

              <h3 className="text-2xl font-semibold text-foreground">
                Calculate Your Monthly Payment
              </h3>

              <p className="mt-3 text-sm text-muted-foreground">
                Enter loan amount, interest rate, and term to see your monthly payment
              </p>

              <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
                <Link href="/calculator">
                  <Button
                    className="btn-primary w-full sm:w-auto px-8 py-3 text-base"
                  >
                    <span className="flex items-center gap-2">
                      Start Calculating
                      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </span>
                  </Button>
                </Link>
              </div>

              {/* Quick Stats */}
              <div className="mt-8 grid grid-cols-3 gap-4 border-t border-border pt-6">
                <div>
                  <p className="text-xs text-muted-foreground">Loan Amount</p>
                  <p className="text-sm font-semibold text-foreground">$100k - $5M</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Terms</p>
                  <p className="text-sm font-semibold text-foreground">10 - 30 Years</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Rate</p>
                  <p className="text-sm font-semibold text-foreground">1% - 15%</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Feature Badges */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={motionTransition(0.35)}
            className="mt-10 flex flex-wrap justify-center gap-3"
          >
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground"
              >
                <feature.icon className="h-4 w-4 text-foreground" />
                <span>{feature.title}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  )
}