import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/currentUser'
import { isSameOriginRequest } from '@/lib/origin'
import {
  brokerReplyNextStatus,
  canBrokerReply,
  toSupportMessageDto,
  validateTicketReply,
} from '@/lib/support-ticket'

function notifyAdmins(title: string, message: string) {
  return prisma.user
    .findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } })
    .then((admins) =>
      admins.length > 0
        ? prisma.notification.createMany({
            data: admins.map((admin) => ({ userId: admin.id, title, message })),
          })
        : null,
    )
    .catch(() => null)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }
  const user = await getCurrentUser()
  if (!user || user.role !== 'BROKER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  let body: { message?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const validationError = validateTicketReply(body.message)
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 })
  }

  // Ownership filter: reply only to your own ticket; never another broker's.
  const ticket = await prisma.supportTicket.findFirst({ where: { id, userId: user.id } })
  if (!ticket) {
    return NextResponse.json({ error: 'Support ticket not found' }, { status: 404 })
  }
  if (!canBrokerReply(ticket.status)) {
    return NextResponse.json(
      { error: 'This ticket no longer accepts replies.' },
      { status: 409 },
    )
  }

  const message = await prisma.supportMessage.create({
    data: {
      ticketId: ticket.id,
      senderId: user.id,
      senderType: 'user',
      message: String(body.message).trim(),
      attachments: [],
    },
  })

  // Broker replies nudge the workflow (waiting_for_broker -> in_progress).
  const nextStatus = brokerReplyNextStatus(ticket.status)
  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: { status: nextStatus, updatedAt: new Date() },
  })

  await notifyAdmins('New broker reply', `Ticket ${ticket.ticketNumber}: ${ticket.subject}`)

  return NextResponse.json({ success: true, message: toSupportMessageDto(message, user.name) }, { status: 201 })
}