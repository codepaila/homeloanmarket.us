import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/currentUser'
import { createFaq } from '@/actions/faqs'
import { FaqForm } from '@/components/admin/faqs/FaqForm'

export const metadata: Metadata = {
  title: 'Add FAQ',
}

export default async function NewFaqPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') redirect('/auth/signin')

  return <FaqForm action={createFaq} initial={{ question: '', answer: '', category: 'General', displayOrder: 0, isActive: true }} />
}
