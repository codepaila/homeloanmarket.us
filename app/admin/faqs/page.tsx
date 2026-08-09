import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/currentUser'
import prisma from '@/lib/prisma'
import { FaqTable } from '@/components/admin/faqs/FaqTable'

export const metadata: Metadata = {
  title: 'FAQs',
}

export default async function AdminFaqsPage({ searchParams }: { searchParams: Promise<{ search?: string; status?: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') redirect('/auth/signin')

  const params = await searchParams
  const search = params.search?.trim() || ''
  const status = params.status === 'published' ? 'published' : params.status === 'draft' ? 'draft' : 'all'

  const faqs = await prisma.fAQ.findMany({
    where: {
      ...(search ? { question: { contains: search, mode: 'insensitive' } } : {}),
      ...(status === 'published' ? { isActive: true } : {}),
      ...(status === 'draft' ? { isActive: false } : {}),
    },
    select: { id: true, question: true, category: true, isActive: true, displayOrder: true, updatedAt: true },
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    take: 100,
  })

  return <FaqTable faqs={faqs} search={search} status={status} />
}
