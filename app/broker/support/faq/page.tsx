import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getCurrentUser } from '@/lib/currentUser'
import prisma from '@/lib/prisma'
import { FaqAccordion } from '@/components/public/faq/FaqAccordion'

export const metadata: Metadata = {
  title: 'Support FAQ',
  robots: { index: false, follow: false },
}

export default async function BrokerSupportFaqPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'BROKER') {
    redirect('/auth/signin')
  }

  // Reuses the platform FAQ system (same data the public /faq page reads).
  const faqs = await prisma.fAQ.findMany({
    where: { isActive: true },
    select: { id: true, question: true, answer: true, category: true },
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Support FAQ</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Common questions and answers to help you get the most out of HomeLoanMarket.
        </p>
      </div>
      {faqs.length === 0 ? (
        <p className="rounded border border-dashed py-12 text-center text-sm text-muted-foreground">
          No FAQs are available right now.
        </p>
      ) : (
        <FaqAccordion faqs={faqs} />
      )}
    </div>
  )
}