'use client'

import { Section, SectionHeader } from '@/components/design/Section'
import { StatsGrid } from '@/components/design/StatCard'
import { AnimatedContainer } from '@/components/design/AnimatedContainer'
import {
  Home,
  TrendingUp,
  Award,
  Users,
  Building,
  DollarSign,
  Globe,
} from 'lucide-react'

const stats = [
  {
    value: '10,000+',
    label: 'Verified Mortgage Originators',
    icon: <Users className="h-5 w-5" />,
    subvalue: 'Across 50+ states',
  },
  {
    value: '850,000+',
    label: 'Loans Facilitated',
    icon: <Home className="h-5 w-5" />,
    subvalue: 'Total loan value',
  },
  {
    value: '$250B+',
    label: 'Funded Volume',
    icon: <DollarSign className="h-5 w-5" />,
    subvalue: 'Across all partners',
  },
  {
    value: '4.8/5',
    label: 'Customer Rating',
    icon: <Award className="h-5 w-5" />,
    subvalue: 'From 25,000+ reviews',
  },
]

export default function StatisticsSection() {
  return (
    <Section size="lg">
      <AnimatedContainer delay={0.1} variant="fadeUp">
        <SectionHeader
          title="Trusted by thousands of borrowers"
          subtitle="Every month, borrowers find their ideal mortgage partner through our platform, closing loans at competitive rates and terms."
          centered
        />
      </AnimatedContainer>

      <AnimatedContainer delay={0.2} variant="fadeUp">
        <StatsGrid stats={stats} />
      </AnimatedContainer>
    </Section>
  )
}
