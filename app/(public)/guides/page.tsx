'use client'

import { motion } from 'motion/react'
import Link from 'next/link'
import { BookOpen, TrendingUp, CreditCard, Home, Search } from 'lucide-react'
import { AnimatedContainer } from '@/components/design/AnimatedContainer'
import { Section } from '@/components/design/Section'
import { AdvertisementRenderer } from '@/components/advertisements'

const guides = [
  {
    title: 'First-Time Home Buyer Guide',
    description: 'Everything you need to know about buying your first home',
    icon: BookOpen,
    topics: ['Pre-approval', 'Down payments', 'Closing costs', 'First-time buyer programs'],
    href: '/guides/first-time-buyer',
  },
  {
    title: 'Mortgage Refinancing Guide',
    description: 'Learn when and how to refinance your mortgage',
    icon: TrendingUp,
    topics: ['Rate and term refinance', 'Cash-out refinance', 'Break-even point', 'Costs involved'],
    href: '/guides/refinancing',
  },
  {
    title: 'Credit Score Improvement',
    description: 'How to improve your credit score for better mortgage rates',
    icon: CreditCard,
    topics: ['Credit report basics', 'Score factors', 'Quick improvements', 'Long-term strategies'],
    href: '/guides/credit-score',
  },
  {
    title: 'Mortgage Types Explained',
    description: 'Understanding different mortgage products',
    icon: Home,
    topics: ['Fixed vs Adjustable', 'FHA loans', 'VA loans', 'Conventional loans'],
    href: '/guides/mortgage-types',
  },
  {
    title: 'Closing Process Guide',
    description: 'Step-by-step through the mortgage closing process',
    icon: Search,
    topics: ['Loan estimate', 'Closing disclosure', 'Final walkthrough', 'Closing day'],
    href: '/guides/closing-process',
  },
  {
    title: 'Mortgage Terminology',
    description: 'Glossary of common mortgage terms',
    icon: BookOpen,
    topics: ['APR', 'PMI', 'Escrow', 'Amortization', 'Points', 'Underwriting'],
    href: '/guides/mortgage-terminology',
  },
]

export default function GuidesPage() {
  return (
    <div className="min-h-screen">
      <Section className="bg-surface">
        <AnimatedContainer>
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="heading-1 text-text-main mb-4">
              Mortgage Guides
            </h1>
            <p className="text-xl text-text-muted max-w-2xl mx-auto">
              Comprehensive resources to help you understand every aspect of the mortgage process,
              from first-time buyer tips to advanced refinancing strategies.
            </p>
          </div>
        </AnimatedContainer>
      </Section>

      <AdvertisementRenderer placement="BLOG_INLINE" />

      <Section className="bg-background">
        <AnimatedContainer>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {guides.map((guide, index) => (
              <motion.div
                key={guide.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Link href={guide.href} className="group">
                  <div className="card h-full transition-all duration-300 group-hover:shadow-medium">
                    <div className="p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <guide.icon className="h-5 w-5 text-primary" />
                        </div>
                        <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                          Guide
                        </span>
                      </div>
                      <h3 className="text-xl font-bold text-text-main mb-3 group-hover:text-primary transition-colors">
                        {guide.title}
                      </h3>
                      <p className="text-text-muted mb-4 text-sm leading-relaxed">
                        {guide.description}
                      </p>
                      <div className="space-y-2 mb-6">
                        {guide.topics.map((topic) => (
                          <div key={topic} className="flex items-center text-sm">
                            <svg className="w-4 h-4 text-primary mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-text-muted">{topic}</span>
                          </div>
                        ))}
                      </div>
                      <div className="inline-flex items-center gap-2 text-sm font-medium text-primary group-hover:text-primary transition-colors">
                        Read Guide
                        <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </AnimatedContainer>
      </Section>
    </div>
  )
}
