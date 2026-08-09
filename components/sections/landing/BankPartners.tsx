'use client'

import { Section, SectionHeader } from '@/components/design/Section'
import { BankCard } from '@/components/design/Cards'
import { AnimatedContainer } from '@/components/design/AnimatedContainer'

const banks = [
  { bankName: 'Chase Bank', bankType: 'PUBLIC' },
  { bankName: 'Bank of America', bankType: 'PRIVATE' },
  { bankName: 'Wells Fargo', bankType: 'PUBLIC' },
  { bankName: 'Citibank', bankType: 'PRIVATE' },
  { bankName: 'U.S. Bank', bankType: 'PUBLIC' },
  { bankName: 'PNC Bank', bankType: 'PRIVATE' },
  { bankName: 'TD Bank', bankType: 'PRIVATE' },
  { bankName: 'Capital One', bankType: 'PRIVATE' },
  { bankName: 'Discover Bank', bankType: 'PRIVATE' },
  { bankName: 'Rocket Mortgage', bankType: 'PRIVATE' },
]

export default function BankPartnersSection() {
  return (
    <Section size="md" className="bg-card-deep/40">
      <AnimatedContainer delay={0.1} variant="fadeUp">
        <SectionHeader
          title="Bank partners"
          subtitle="Our mortgage brokers work with leading banks to secure competitive mortgage rates for you."
          centered
        />
      </AnimatedContainer>

      <AnimatedContainer delay={0.2} variant="fadeUp">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {banks.map((bank) => (
            <BankCard
              key={bank.bankName}
              bankName={bank.bankName}
              bankType={bank.bankType}
            />
          ))}
        </div>
      </AnimatedContainer>
    </Section>
  )
}
