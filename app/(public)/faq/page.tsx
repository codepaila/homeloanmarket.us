import type { Metadata } from 'next'
import prisma from '@/lib/prisma'
import { canonicalUrl, safeJsonLd } from '@/lib/seo'
import { AnimatedContainer } from '@/components/design/AnimatedContainer'
import { Section } from '@/components/design/Section'
import { FaqAccordion } from '@/components/public/faq/FaqAccordion'

export const metadata: Metadata = {
  title: 'Frequently Asked Questions',
  description: 'Answers to common questions about HomeLoanMarket and the mortgage process.',
  alternates: { canonical: canonicalUrl('/faq') },
  openGraph: {
    type: 'website',
    title: 'Frequently Asked Questions',
    description: 'Answers to common questions about HomeLoanMarket and the mortgage process.',
    url: canonicalUrl('/faq'),
  },
  robots: { index: true, follow: true },
}

export default async function FAQPage() {
  const faqs = await prisma.fAQ.findMany({
    where: { isActive: true },
    select: { id: true, question: true, answer: true, category: true },
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
  })

  const jsonLd = safeJsonLd({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  })

  return (
    <div className="min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <Section className="bg-surface">
        <AnimatedContainer>
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="heading-1 text-text-main mb-4">Frequently Asked Questions</h1>
            <p className="text-xl text-text-muted">
              Find answers to common questions about HomeLoanMarket and the mortgage process.
            </p>
          </div>
        </AnimatedContainer>
      </Section>

      <Section className="bg-background">
        <AnimatedContainer>
          {faqs.length === 0 ? (
            <div className="max-w-4xl mx-auto text-center py-12 text-text-muted">No FAQs are available right now.</div>
          ) : (
            <FaqAccordion faqs={faqs} />
          )}
        </AnimatedContainer>
      </Section>
    </div>
  )
}
