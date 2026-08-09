'use client'

import ResourceCard from '@/components/sections/broker/ui/card/ResourceCard'
import { Calculator, BookOpen } from 'lucide-react'
import { Section, SectionHeader } from '@/components/design/Section'
import { AnimatedContainer } from '@/components/design/AnimatedContainer'

const resources = [
  {
    title: 'Mortgage Calculator',
    description: 'Calculate your potential mortgage repayments using our calculator.',
    icon: <Calculator className="h-10 w-10 text-primary" />,
    link: '/calculator',
    linkText: 'Calculate Now',
  },
  {
    title: 'Mortgage Terms',
    description: 'Familiarize yourself with mortgage terminology before selecting a product.',
    icon: <BookOpen className="h-10 w-10 text-primary" />,
    link: '/guides',
    linkText: 'Read Guide',
  },
]

export default function Resources() {
  return (
    <Section size="lg" className="border-t border-border">
      <AnimatedContainer delay={0.1} variant="fadeUp">
        <SectionHeader
          title="Mortgage resources"
          subtitle="Learn about the resources provided by our platform to help you make informed decisions."
          centered
        />
      </AnimatedContainer>

      <AnimatedContainer delay={0.2} variant="fadeUp">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2">
          {resources.map((resource, index) => (
            <ResourceCard key={index} resource={resource} />
          ))}
        </div>
      </AnimatedContainer>
    </Section>
  )
}
