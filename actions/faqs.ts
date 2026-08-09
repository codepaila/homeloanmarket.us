'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/currentUser'

type FaqState = { error?: string } | undefined

async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return null
  return user
}

function parseFaqInput(formData: FormData) {
  const question = (formData.get('question')?.toString() || '').trim()
  const answer = (formData.get('answer')?.toString() || '').trim()
  const category = (formData.get('category')?.toString() || '').trim()
  const rawOrder = formData.get('displayOrder')?.toString() || '0'
  const isActive = formData.get('isActive') === 'true'

  if (!question) return { error: 'Question is required.' }
  if (question.length > 300) return { error: 'Question must be 300 characters or fewer.' }
  if (!answer) return { error: 'Answer is required.' }
  if (answer.length > 5000) return { error: 'Answer must be 5000 characters or fewer.' }
  const displayOrder = Number.parseInt(rawOrder, 10)
  if (Number.isNaN(displayOrder)) return { error: 'Display order must be a number.' }

  return { question, answer, category, displayOrder, isActive }
}

function revalidateFaqs() {
  revalidatePath('/admin/faqs')
  revalidatePath('/faq')
}

export async function createFaq(_previousState: FaqState, formData: FormData): Promise<FaqState> {
  const admin = await requireAdmin()
  if (!admin) return { error: 'Unauthorized' }

  const parsed = parseFaqInput(formData)
  if ('error' in parsed) return parsed

  const existing = await prisma.fAQ.findFirst({ where: { question: parsed.question } })
  if (existing) return { error: 'An FAQ with this question already exists.' }

  await prisma.fAQ.create({
    data: {
      question: parsed.question,
      answer: parsed.answer,
      category: parsed.category || null,
      displayOrder: parsed.displayOrder,
      isActive: parsed.isActive,
    },
  })

  revalidateFaqs()
  redirect('/admin/faqs')
}

export async function updateFaq(faqId: string, _previousState: FaqState, formData: FormData): Promise<FaqState> {
  const admin = await requireAdmin()
  if (!admin) return { error: 'Unauthorized' }

  const existing = await prisma.fAQ.findUnique({ where: { id: faqId } })
  if (!existing) return { error: 'FAQ not found.' }

  const parsed = parseFaqInput(formData)
  if ('error' in parsed) return parsed

  const duplicate = await prisma.fAQ.findFirst({ where: { question: parsed.question, id: { not: faqId } } })
  if (duplicate) return { error: 'An FAQ with this question already exists.' }

  await prisma.fAQ.update({
    where: { id: faqId },
    data: {
      question: parsed.question,
      answer: parsed.answer,
      category: parsed.category || null,
      displayOrder: parsed.displayOrder,
      isActive: parsed.isActive,
    },
  })

  revalidateFaqs()
  redirect('/admin/faqs')
}

export async function toggleFaq(faqId: string): Promise<void> {
  const admin = await requireAdmin()
  if (!admin) return

  const existing = await prisma.fAQ.findUnique({ where: { id: faqId } })
  if (!existing) return

  await prisma.fAQ.update({ where: { id: faqId }, data: { isActive: !existing.isActive } })
  revalidateFaqs()
}

export async function deleteFaq(faqId: string): Promise<void> {
  const admin = await requireAdmin()
  if (!admin) return

  await prisma.fAQ.delete({ where: { id: faqId } }).catch(() => undefined)
  revalidateFaqs()
}

export async function moveFaq(faqId: string, direction: 'up' | 'down'): Promise<void> {
  const admin = await requireAdmin()
  if (!admin) return

  const current = await prisma.fAQ.findUnique({ where: { id: faqId } })
  if (!current) return

  const neighbors = await prisma.fAQ.findMany({ select: { id: true, displayOrder: true }, orderBy: { displayOrder: 'asc' } })
  const index = neighbors.findIndex((faq) => faq.id === faqId)
  const targetIndex = direction === 'up' ? index - 1 : index + 1
  if (index < 0 || targetIndex < 0 || targetIndex >= neighbors.length) return

  const neighbor = neighbors[targetIndex]
  await prisma.fAQ.update({ where: { id: faqId }, data: { displayOrder: neighbor.displayOrder } })
  await prisma.fAQ.update({ where: { id: neighbor.id }, data: { displayOrder: current.displayOrder } })
  revalidateFaqs()
}
