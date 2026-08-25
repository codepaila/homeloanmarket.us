import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/currentUser'
import { toSupportMessageDto, toSupportTicketDto } from '@/lib/support-ticket'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'BROKER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  // Ownership filter: a broker may only ever read their own ticket. A missing
  // ticket (or another broker's ticket) yields the same 404 so existence is
  // never leaked.
  const ticket = await prisma.supportTicket.findFirst({
    where: { id, userId: user.id },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  })

  if (!ticket) {
    return NextResponse.json({ error: 'Support ticket not found' }, { status: 404 })
  }

  const senderIds = [...new Set(ticket.messages.map((m) => m.senderId))]
  const senders = senderIds.length
    ? await prisma.user.findMany({ where: { id: { in: senderIds } }, select: { id: true, name: true } })
    : []
  const senderNameById = new Map(senders.map((s) => [s.id, s.name]))

  return NextResponse.json({
    ticket: toSupportTicketDto(ticket, ticket.messages.length),
    messages: ticket.messages.map((m) => toSupportMessageDto(m, senderNameById.get(m.senderId) ?? null)),
  })
}