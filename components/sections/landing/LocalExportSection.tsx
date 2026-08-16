'use client'

import { motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { PremiumButton } from '@/components/design/PremiumButton'
import { Button } from '@/components/ui/button'

export default function LocalExpertSection() {
  const prefersReducedMotion = useReducedMotion()

  const motionTransition = (delay: number) => ({
    duration: prefersReducedMotion ? 0 : 0.6,
    delay: prefersReducedMotion ? 0 : delay,
    ease: [0.25, 0.46, 0.45, 0.94] as const,
  })

  return (
    <section className="py-16 md:py-20 lg:py-24 bg-white">
      <div className="container-custom">
        <div className="mx-auto max-w-3xl text-center">
          {/* Main Heading - Find Your Expert */}
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={motionTransition(0.1)}
            className="text-4xl font-bold text-secondary sm:text-5xl md:text-5xl lg:text-6xl"
          >
            <span className="text-primary">
              Find Your Expert
            </span>
          </motion.h2>

          {/* Subheading - Local Expertise Makes All the Difference */}
          <motion.h3
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={motionTransition(0.15)}
            className="mt-3 text-2xl font-semibold text-secondary/90 sm:text-3xl md:text-3xl"
          >
            Local Expertise Makes All the Difference
          </motion.h3>

          {/* First Paragraph */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={motionTransition(0.2)}
            className="mx-auto mt-6 text-base leading-relaxed text-secondary/70 sm:text-lg"
          >
            Home values, property taxes, and lending programs vary from city to city. 
            HomeLoanMarket helps you find mortgage brokers who specialize in your local 
            market and understand the unique factors that affect home buying in your area.
          </motion.p>

          {/* Second Paragraph */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={motionTransition(0.25)}
            className="mx-auto mt-4 text-base leading-relaxed text-secondary/70 sm:text-lg"
          >
            Our directory connects you with licensed professionals who live and work in 
            your community, giving you access to personalized guidance and local insights 
            that online lenders simply can&apos;t match.
          </motion.p>

          {/* CTA Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={motionTransition(0.3)}
            className="mt-8"
          >
            <Link href="/brokers" className="group inline-block">
              <Button
                size="lg"
                className="relative overflow-hidden "
              >
                <span className="relative z-10 flex items-center">
                  Find Your Local Expert
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  )
}