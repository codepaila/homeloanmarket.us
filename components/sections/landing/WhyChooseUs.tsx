'use client'

import { Section, SectionHeader } from '@/components/design/Section'
import { FeatureCard } from '@/components/design/Cards'
import { AnimatedContainer } from '@/components/design/AnimatedContainer'
import { Shield, Clock, TrendingUp, Award, Lock, Headphones } from 'lucide-react'

const features = [
  {
    title: 'Verified Mortgage Brokers Only',
    description:
      'Every mortgage broker on our platform is identity-verified with bank partnerships and credentials checked.',
    icon: <Shield className="h-6 w-6 text-primary" />,
  },
  {
    title: 'Transparent Reviews',
    description:
      'Read honest borrower reviews and see verified loan outcomes before making your choice.',
    icon: <Award className="h-6 w-6 text-primary" />,
  },
  {
    title: 'Faster Matching',
    description:
      'Our smart matching algorithm connects you with the right broker based on your profile.',
    icon: <Clock className="h-6 w-6 text-primary" />,
  },
  {
    title: 'No Hidden Fees',
    description:
      'Zero commission for borrowers. Compare mortgage brokers by price, service, and reviews.',
    icon: <TrendingUp className="h-6 w-6 text-primary" />,
  },
  {
    title: 'Bank-Level Security',
    description:
      'Your data is encrypted and never shared without your consent. GDPR compliant.',
    icon: <Lock className="h-6 w-6 text-primary" />,
  },
  {
    title: 'Dedicated Support',
    description:
      'Our support team is available Mon-Fri to help you at every stage of your journey.',
    icon: <Headphones className="h-6 w-6 text-primary" />,
  },
]

export default function WhyChooseUsSection() {
  return (
    <Section size="lg" className="bg-primary/[0.04]">
      <AnimatedContainer delay={0.1} variant="fadeUp">
        <SectionHeader
          title="Why choose HomeLoanMarket?"
          subtitle="We have streamlined the broker-finding process so you can focus on what matters most — your home."
          centered
        />
      </AnimatedContainer>

      <AnimatedContainer delay={0.2} variant="fadeUp">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <FeatureCard
              key={feature.title}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
            />
          ))}
        </div>
      </AnimatedContainer>
    </Section>
  )
}
