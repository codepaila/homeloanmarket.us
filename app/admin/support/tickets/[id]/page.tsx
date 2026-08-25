import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getCurrentUser } from '@/lib/currentUser'
import prisma from '@/lib/prisma'
import { AdminSupportTicketDetail } from '@/components/support/AdminSupportTicketDetail'
import { SUPPORT_TICKET_STATUSES, isAdminStatusTransitionAllowed, toSupportMessageDto, toSupportTicketDto } from '@/lib/support-ticket'

export const metadata: Metadata = {
  title: 'Support Ticket',
  robots: { index: false, follow: false },
}

export default async function AdminSupportTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') {
    redirect('/auth/signin')
  }

  const { id } = await params
  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      messages: { orderBy: { createdAt: 'asc' } },
    },
  })

  if (!ticket) {
    notFound()
  }

  const senderIds = [...new Set(ticket.messages.map((m) => m.senderId))]
  const senders = senderIds.length
    ? await prisma.user.findMany({ where: { id: { in: senderIds } }, select: { id: true, name: true } })
    : []
  const senderNameById = new Map(senders.map((s) => [s.id, s.name]))

  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', isActive: true },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  })

  // Admin-controlled status transitions allowed from the current status.
  const allowedStatuses = SUPPORT_TICKET_STATUSES.filter((candidate) =>
    isAdminStatusTransitionAllowed(ticket.status, candidate),
  )

  return (
    <AdminSupportTicketDetail
      ticket={toSupportTicketDto(ticket, ticket.messages.length)}
      broker={ticket.user ? { id: ticket.user.id, name: ticket.user.name, email: ticket.user.email, phone: ticket.user.phone } : null}
      messages={ticket.messages.map((m) => toSupportMessageDto(m, senderNameById.get(m.senderId) ?? null))}
      admins={admins.map((a) => ({ id: a.id, name: a.name, email: a.email }))}
      assignedTo={ticket.assignedTo}
      allowedStatuses={allowedStatuses}
    />
  )
}