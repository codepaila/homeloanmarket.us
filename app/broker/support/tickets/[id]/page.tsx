import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getCurrentUser } from '@/lib/currentUser'
import prisma from '@/lib/prisma'
import { SupportTicketDetail } from '@/components/support/SupportTicketDetail'
import { toSupportMessageDto, toSupportTicketDto } from '@/lib/support-ticket'

export const metadata: Metadata = {
  title: 'Support Ticket',
  robots: { index: false, follow: false },
}

export default async function BrokerSupportTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'BROKER') {
    redirect('/auth/signin')
  }

  const { id } = await params

  // Ownership filter: only the ticket owner can view it; anyone else gets a 404.
  const ticket = await prisma.supportTicket.findFirst({
    where: { id, userId: user.id },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  })

  if (!ticket) {
    notFound()
  }

  const senderIds = [...new Set(ticket.messages.map((m) => m.senderId))]
  const senders = senderIds.length
    ? await prisma.user.findMany({ where: { id: { in: senderIds } }, select: { id: true, name: true } })
    : []
  const senderNameById = new Map(senders.map((s) => [s.id, s.name]))

  return (
    <SupportTicketDetail
      ticket={toSupportTicketDto(ticket, ticket.messages.length)}
      messages={ticket.messages.map((m) => toSupportMessageDto(m, senderNameById.get(m.senderId) ?? null))}
    />
  )
}