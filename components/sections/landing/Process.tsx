'use client'

import { motion } from 'motion/react'
import { Section, SectionHeader } from '@/components/design/Section'
import { AnimatedContainer } from '@/components/design/AnimatedContainer'
import { Search, Users, FileText, CreditCard } from 'lucide-react'

const steps = [
  {
    step: 1,
    title: 'Find Mortgage Brokers',
    description:
      'Enter your location and loan preferences to find verified mortgage brokers near you.',
    icon: Search,
  },
  {
    step: 2,
    title: 'Compare & Review',
    description:
      'Search mortgage broker profiles, compare specializations, and read verified borrower reviews.',
    icon: Users,
  },
  {
    step: 3,
    title: 'Connect Directly',
    description:
      'Reach out to your chosen broker through the platform or directly via phone.',
    icon: FileText,
  },
  {
    step: 4,
    title: 'Close Your Loan',
    description:
      'Work with your broker to finalize your mortgage with competitive rates and terms.',
    icon: CreditCard,
  },
]

export default function ProcessSection() {
  return (
    <Section size="lg">
      <AnimatedContainer delay={0.1} variant="fadeUp">
        <SectionHeader
          title="How It Works"
          subtitle="Getting connected with the right mortgage broker is simple. Follow these steps."
          centered
        />
      </AnimatedContainer>

      <AnimatedContainer delay={0.2} variant="fadeUp">
        <div className="relative">
          {/* Connector line (desktop) */}
          <div
            className="absolute left-[12.5%] right-[12.5%] top-7 hidden h-0.5 bg-primary/20 lg:block"
            aria-hidden="true"
          />

          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {steps.map((step, idx) => {
              const Icon = step.icon
              return (
                <motion.div
                  key={step.step}
                  className="group relative flex flex-col items-center text-center"
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.5, delay: idx * 0.12 }}
                >
                  {/* Step node */}
                  <div className="relative z-10 mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/15 bg-card shadow-soft transition-all duration-300 group-hover:-translate-y-1 group-hover:border-primary/40 group-hover:shadow-medium">
                    <Icon className="h-6 w-6 text-primary" />
                    <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white">
                      {step.step}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-text-main">
                    {step.title}
                  </h3>
                  <p className="mt-2 max-w-[240px] text-sm leading-relaxed text-text-muted">
                    {step.description}
                  </p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </AnimatedContainer>
    </Section>
  )
}
