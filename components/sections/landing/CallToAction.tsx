'use client'

import Link from 'next/link'
import { motion } from 'motion/react'
import { ArrowRight, ShieldCheck, Star } from 'lucide-react'
import { PremiumButton } from '@/components/design/PremiumButton'
import { AnimatedContainer } from '@/components/design/AnimatedContainer'

export default function CallToActionSection() {
  return (
    <section className="relative overflow-hidden bg-primary">
      {/* Subtle decorative glows */}
      <div
        className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-primary/30 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-primary/20 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute right-1/4 top-8 h-24 w-24 rounded-full border border-white/10"
        aria-hidden="true"
      />

      <AnimatedContainer delay={0.1} variant="fadeUp">
        <div className="container-custom relative py-16 text-center md:py-24">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold text-white backdrop-blur-sm"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Free for borrowers · No hidden fees
          </motion.div>

          <h2 className="mx-auto max-w-3xl text-balance text-3xl font-extrabold leading-tight text-white md:text-5xl">
            Ready to find your mortgage broker?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/80">
            Join thousands of borrowers who found the right mortgage broker and
            saved on their mortgage. It&apos;s free and takes less than a minute.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/brokers">
              <PremiumButton variant="secondary" size="lg">
                Find Mortgage Brokers
                <ArrowRight className="ml-2 h-4 w-4" />
              </PremiumButton>
            </Link>
            <Link href="/subscription">
              <PremiumButton
                variant="ghost"
                size="lg"
                className="border border-white/25 bg-white/5 text-white hover:bg-white/10"
              >
                View Subscription Plans
              </PremiumButton>
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-white/60">
            <span className="flex items-center gap-1.5">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              4.8/5 average borrower rating
            </span>
            <span className="hidden h-4 w-px bg-white/20 sm:block" />
            <span>10,000+ verified mortgage brokers</span>
            <span className="hidden h-4 w-px bg-white/20 sm:block" />
            <span>$2.5B+ loans facilitated</span>
          </div>
        </div>
      </AnimatedContainer>
    </section>
  )
}
