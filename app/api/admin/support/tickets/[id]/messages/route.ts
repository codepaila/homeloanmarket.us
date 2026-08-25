import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/currentUser'
import { isSameOriginRequest } from '@/lib/origin'
import {
  adminReplyNextStatus,
  canBrokerReply,
  toSupportMessageDto,
  validateTicketReply,
} from '@/lib/support-ticket'

async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return null
  return user
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }
  const admin = await requireAdmin()
  if (!admin) {
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

  const ticket = await prisma.supportTicket.findUnique({ where: { id } })
  if (!ticket) {
    return NextResponse.json({ error: 'Support ticket not found' }, { status: 404 })
  }
  if (!canBrokerReply(ticket.status)) {
    return NextResponse.json(
      { error: 'This ticket is closed. Reopen it before replying.' },
      { status: 409 },
    )
  }

  const message = await prisma.supportMessage.create({
    data: {
      ticketId: ticket.id,
      senderId: admin.id,
      senderType: 'support_agent',
      message: String(body.message).trim(),
      attachments: [],
    },
  })

  // Admin reply moves the workflow forward to waiting_for_broker and assigns
  // the replying admin when the ticket was unassigned.
  const nextStatus = adminReplyNextStatus(ticket.status)
  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: {
      status: nextStatus,
      updatedAt: new Date(),
      ...(ticket.assignedTo ? {} : { assignedTo: admin.id }),
    },
  })

  // Notify the ticket owner (the broker) of the admin response.
  await prisma.notification
    .create({
      data: {
        userId: ticket.userId,
        title: 'Response on your support ticket',
        message: `Ticket ${ticket.ticketNumber}: ${ticket.subject}`,
      },
    })
    .catch(() => null)

  return NextResponse.json({ success: true, message: toSupportMessageDto(message, admin.name) }, { status: 201 })
}