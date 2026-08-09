'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ChevronDown, Search, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export type PublicFaq = {
  id: string
  question: string
  answer: string
  category: string | null
}

export function FaqAccordion({ faqs }: { faqs: PublicFaq[] }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')

  const categories = ['All', ...Array.from(new Set(faqs.map((faq) => faq.category || 'General').filter(Boolean)))]

  const filteredFAQs = faqs.filter((faq) => {
    const matchesSearch =
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === 'All' || (faq.category || 'General') === selectedCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div className="max-w-4xl mx-auto">
      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted" />
        <input
          type="text"
          placeholder="Search for questions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-xl border border-border bg-background/50 pl-12 pr-4 py-3 text-base transition-all duration-200 placeholder:text-text-muted/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={cn(
              'px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200',
              selectedCategory === category
                ? 'bg-primary text-white'
                : 'bg-surface text-text-muted hover:bg-primary/10 hover:text-primary',
            )}
          >
            {category}
          </button>
        ))}
      </div>

      {filteredFAQs.length === 0 ? (
        <div className="text-center py-12">
          <HelpCircle className="h-12 w-12 text-text-muted/30 mx-auto mb-4" />
          <p className="text-text-muted">No questions found matching your search.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredFAQs.map((faq) => (
            <motion.div
              key={faq.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <button type="button" onClick={() => setOpenId(openId === faq.id ? null : faq.id)} className="w-full text-left">
                <div className="card">
                  <div className="flex items-center justify-between p-6">
                    <h3 className="text-lg font-medium text-text-main pr-4">{faq.question}</h3>
                    <motion.div animate={{ rotate: openId === faq.id ? 180 : 0 }} transition={{ duration: 0.3 }} className="flex-shrink-0">
                      <ChevronDown className="h-5 w-5 text-text-muted" />
                    </motion.div>
                  </div>
                  <AnimatePresence initial={false}>
                    {openId === faq.id && (
                      <motion.div
                        key={`answer-${faq.id}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                        className="px-6 pb-4"
                      >
                        <div className="border-t border-border pt-4">
                          <p className="text-text-muted leading-relaxed">{faq.answer}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
