'use client'

import { Section, SectionHeader } from '@/components/design/Section'
import { TestimonialGrid } from '@/components/design/Cards'
import { AnimatedContainer } from '@/components/design/AnimatedContainer'
import { Star } from 'lucide-react'

const testimonials = [
  {
    name: 'Sarah Johnson',
    role: 'Homeowner, Dallas',
    content:
      'Finding the right mortgage broker felt impossible until I discovered HomeLoanMarket. The broker I connected with saved me over $30K in interest over the life of my loan. Highly recommended!',
    rating: 5,
  },
  {
    name: 'Michael Chen',
    role: 'First-time Buyer, Austin',
    content:
      'The reviews were genuine and helpful. I could read real borrower experiences before choosing my broker. The whole process was smooth and transparent.',
    rating: 5,
  },
  {
    name: 'Emily Rodriguez',
    role: 'Homeowner, Miami',
    content:
      'The broker matched with me was knowledgeable, responsive, and got me a great rate. The platform made comparing brokers and their offers so much easier.',
    rating: 4,
  },
  {
    name: 'David Kim',
    role: 'Homeowner, Chicago',
    content:
      'I was skeptical at first, but the entire team helped me navigate the process from start to finish. My broker was professional and found me a better deal than I expected.',
    rating: 5,
  },
  {
    name: 'Jessica Patel',
    role: 'Homeowner, Denver',
    content:
      'The transparency of reviews and broker profiles gave me the confidence to make the right decision. The support team was responsive throughout my journey.',
    rating: 5,
  },
  {
    name: 'Chris Anderson',
    role: 'Homeowner, Seattle',
    content:
      'A seamless experience. The platform connected me with a local broker who understood the market well. I closed my loan without any surprises.',
    rating: 4,
  },
]

const starIcon = (
  <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
)

export default function TestimonialsSection() {
  return (
    <Section size="lg">
      <AnimatedContainer delay={0.1} variant="fadeUp">
        <SectionHeader
          title="What our borrowers say"
          subtitle="Join thousands who found their right mortgage broker through our platform."
          centered
        />
      </AnimatedContainer>

      <AnimatedContainer delay={0.2} variant="fadeUp">
        <TestimonialGrid testimonials={testimonials} />
      </AnimatedContainer>
    </Section>
  )
}

export { starIcon }
