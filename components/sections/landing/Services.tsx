'use client'

import { Section, SectionHeader } from '@/components/design/Section'
import { FeatureCard } from '@/components/design/Cards'
import { AnimatedContainer } from '@/components/design/AnimatedContainer'
import {
  Search,
  Shield,
  TrendingUp,
  Users,
  FileText,
  Clock,
} from 'lucide-react'

const services = [
  {
    title: 'Find Mortgage Brokers',
    description:
      'Find verified mortgage brokers in your area with transparent pricing, ratings, and reviews.',
    icon: <Search className="h-6 w-6 text-primary" />,
    link: '/brokers',
  },
  {
    title: 'Verified Reviews',
    description:
      'Read real borrower reviews to choose a mortgage broker you can trust.',
    icon: <Shield className="h-6 w-6 text-primary" />,
    link: '/guides',
  },
  {
    title: 'Compare Loan Programs',
    description:
      'Compare mortgage programs, rates, and bank partnerships side by side.',
    icon: <TrendingUp className="h-6 w-6 text-primary" />,
    link: '/calculator',
  },
  {
    title: 'Mortgage Guidance',
    description:
      'Access guides and calculators to make confident mortgage decisions.',
    icon: <FileText className="h-6 w-6 text-primary" />,
    link: '/guides',
  },
]

export default function ServicesSection() {
  return (
    <Section size="lg" className="bg-surface">
      <AnimatedContainer delay={0.1} variant="fadeUp">
        <SectionHeader
          title="Everything you need to find the right mortgage broker"
          subtitle="From discovery to decision, we guide you through every step of your mortgage journey."
          centered
        />
      </AnimatedContainer>

      <AnimatedContainer delay={0.2} variant="fadeUp">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((service) => (
            <FeatureCard
              key={service.title}
              icon={service.icon}
              title={service.title}
              description={service.description}
              link={service.link}
            />
          ))}
        </div>
      </AnimatedContainer>
    </Section>
  )
}
