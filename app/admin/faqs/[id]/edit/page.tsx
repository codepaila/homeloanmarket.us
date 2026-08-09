import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/currentUser'
import prisma from '@/lib/prisma'
import { updateFaq } from '@/actions/faqs'
import { FaqForm } from '@/components/admin/faqs/FaqForm'

export const metadata: Metadata = {
  title: 'Edit FAQ',
}

export default async function EditFaqPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') redirect('/auth/signin')

  const { id } = await params
  const faq = await prisma.fAQ.findUnique({ where: { id } })
  if (!faq) redirect('/admin/faqs')

  return (
    <FaqForm
      action={updateFaq.bind(null, id)}
      initial={{ id, question: faq.question, answer: faq.answer, category: faq.category || '', displayOrder: faq.displayOrder, isActive: faq.isActive }}
    />
  )
}
