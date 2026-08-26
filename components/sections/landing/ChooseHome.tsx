'use client'

import { motion } from 'motion/react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { PremiumButton } from '@/components/design/PremiumButton'
import { AnimatedContainer } from '@/components/design/AnimatedContainer'
import { cn } from '@/lib/utils'

export default function ChooseHomeSection() {
  return (
    <section className="section-spacing border-t border-border">
      <AnimatedContainer delay={0.1} variant="fadeUp">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
          <div className="space-y-6">
            <h2 className="text-balance text-3xl font-bold text-text-main sm:text-4xl">
              A smarter way to choose your mortgage
            </h2>
            <p className="text-text-muted max-w-2xl">
              Mortgage options aren&apos;t one-size-fits-all. Rates, programs, and
              approvals can vary widely based on the lender, location, and
              borrower profile. That&apos;s why transparency and choice matter when
              selecting a mortgage.
            </p>
            <p className="text-text-muted max-w-2xl pt-2">
              This platform is built to bring multiple lending professionals into
              one place — so you can explore your options clearly, ask the right
              questions, and move forward with confidence instead of
              uncertainty.
            </p>

            <Link href="/brokers">
              <PremiumButton size="md">
                 Find a Mortgage Originator
                <ArrowRight className="ml-2 h-4 w-4" />
              </PremiumButton>
            </Link>
          </div>

          <motion.div
            className={cn(
              'relative aspect-video rounded-2xl border border-border overflow-hidden',
              'shadow-large',
            )}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          >
            <Image
              src="/assets/images/cover.jpg"
              alt="Modern home exterior"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </motion.div>
        </div>
      </AnimatedContainer>
    </section>
  )
}
