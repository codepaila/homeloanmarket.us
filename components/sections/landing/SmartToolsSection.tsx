'use client'

import { motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'
import { ArrowRight, Calculator } from 'lucide-react'
import { PremiumButton } from '@/components/design/PremiumButton'

export default function SmartToolsSection() {
  const prefersReducedMotion = useReducedMotion()

  const motionTransition = (delay: number) => ({
    duration: prefersReducedMotion ? 0 : 0.6,
    delay: prefersReducedMotion ? 0 : delay,
    ease: [0.25, 0.46, 0.45, 0.94] as const,
  })

  return (
    <section className="py-16 md:py-20 lg:py-24 bg-gradient-to-b from-secondary to-secondary/95">
      <div className="container-custom">
        <div className="mx-auto max-w-4xl text-center">
          {/* Section Badge */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={motionTransition(0)}
            className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary backdrop-blur-sm"
          >
            <Calculator className="h-3.5 w-3.5" />
            <span>Smart Tools</span>
          </motion.div>

          {/* Main Heading */}
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={motionTransition(0.1)}
            className="mt-4 text-3xl font-bold text-white sm:text-4xl md:text-5xl lg:text-5xl"
          >
            <span className="bg-gradient-to-r from-primary to-emerald-500 bg-clip-text text-transparent">
              Smart Tools
            </span>
            <span className="text-white"> for Smarter Home Buying Decisions</span>
          </motion.h2>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={motionTransition(0.2)}
            className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg"
          >
            Estimate monthly payments, check affordability, and plan your home financing 
            journey with confidence.
          </motion.p>

          {/* Single Tool Card - Monthly Payment Calculator */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={motionTransition(0.25)}
            className="mt-8 mx-auto max-w-md"
          >
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-sm transition-all hover:border-primary/30 hover:bg-white/10">
              <div className="mb-4 flex justify-center">
                <div className="rounded-full bg-primary/20 p-4">
                  <Calculator className="h-8 w-8 text-primary" />
                </div>
              </div>
              <h4 className="text-xl font-semibold text-white">Monthly Payment Calculator</h4>
              <p className="mt-2 text-sm text-white/60">Estimate your monthly mortgage payment</p>
              <Link href="/calculator" className="group mt-6 inline-flex items-center justify-center">
                <PremiumButton
                  variant="primary"
                  size="lg"
                  className="relative overflow-hidden bg-gradient-to-r from-primary to-emerald-600 px-8 py-3.5 text-base shadow-lg hover:shadow-2xl"
                >
                  <span className="relative z-10 flex items-center">
                    Calculate Now
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                  <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
                </PremiumButton>
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}