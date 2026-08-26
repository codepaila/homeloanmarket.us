'use client'

import { Section, SectionHeader } from '@/components/design/Section'
import { AnimatedContainer } from '@/components/design/AnimatedContainer'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { PremiumButton } from '@/components/design/PremiumButton'

const faqs = [
  {
    question: 'How do I find a mortgage originator on HomeLoanMarket?',
    answer:
       'Simply enter your city or use our search filters to browse verified mortgage originators in your area. You can filter by specialization, rating, and more. Each originator profile includes reviews, specialties, and contact options.',
  },
  {
    question: 'Is it free to search for mortgage originators?',
    answer:
      'Yes. Searching, comparing, and contacting mortgage originators is completely free for borrowers. There are no hidden fees or commissions. Some originators may charge a consultation fee, which they will disclose upfront.',
  },
  {
    question: 'Are the mortgage originators on this platform verified?',
    answer:
      'We verify the identity and credentials of every mortgage originator on our platform. Verified mortgage originators display a "Verified" badge. You can also read genuine borrower reviews to make an informed decision.',
  },
  {
    question: 'How do I contact a mortgage originator?',
    answer:
      'Each mortgage originator profile includes contact options such as phone, WhatsApp, email, and a contact form. For originators on a Free Plan, you can message them through our secure platform.',
  },
  {
    question: 'Can I leave a review for a mortgage originator I worked with?',
    answer:
      'Yes. After working with a mortgage originator, you can leave a verified review on their profile. This helps other borrowers make confident choices. You will need to provide your contact details for verification.',
  },
]

export default function FAQSection() {
  return (
    <Section size="lg" className="bg-primary/[0.04]">
      <AnimatedContainer delay={0.1} variant="fadeUp">
        <SectionHeader
          title="Frequently asked questions"
          subtitle="Everything you need to know about finding and working with mortgage originators."
          centered
        />
      </AnimatedContainer>

      <AnimatedContainer delay={0.2} variant="fadeUp">
        <div className="mx-auto max-w-3xl">
          <Accordion type="single" collapsible className="w-full space-y-3">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="border-border"
              >
                <AccordionTrigger className="text-left font-semibold py-4">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-text-muted pb-4">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </AnimatedContainer>

      <AnimatedContainer delay={0.3} variant="fadeUp">
        <div className="text-center mt-12">
          <Link href="/faq">
            <PremiumButton variant="secondary" size="md">
              Visit Help Center
              <ArrowRight className="h-4 w-4 ml-2" />
            </PremiumButton>
          </Link>
        </div>
      </AnimatedContainer>
    </Section>
  )
}
