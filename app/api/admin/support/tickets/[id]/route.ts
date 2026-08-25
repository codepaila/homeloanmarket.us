import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/currentUser'
import { isSameOriginRequest } from '@/lib/origin'
import {
  SUPPORT_TICKET_PRIORITIES,
  isAdminStatusTransitionAllowed,
  toSupportMessageDto,
  toSupportTicketDto,
} from '@/lib/support-ticket'

async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return null
  return user
}

async function withSenderNames(messages: Array<{ senderId: string }>, prismaClient: typeof prisma) {
  const senderIds = [...new Set(messages.map((m) => m.senderId))]
  const senders = senderIds.length
    ? await prismaClient.user.findMany({ where: { id: { in: senderIds } }, select: { id: true, name: true } })
    : []
  const senderNameById = new Map(senders.map((s) => [s.id, s.name]))
  return messages.map((m) => toSupportMessageDto(m, senderNameById.get(m.senderId) ?? null))
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
    return NextResponse.json({ error: 'Support ticket not found' }, { status: 404 })
  }

  return NextResponse.json({
    ticket: toSupportTicketDto(ticket, ticket.messages.length),
    broker: ticket.user,
    messages: await withSenderNames(ticket.messages, prisma),
  })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  let body: { status?: unknown; priority?: unknown; assignedTo?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const ticket = await prisma.supportTicket.findUnique({ where: { id } })
  if (!ticket) {
    return NextResponse.json({ error: 'Support ticket not found' }, { status: 404 })
  }

  const updateData: {
    status?: string
    priority?: string
    assignedTo?: string | null
    resolvedAt?: Date | null
    closedAt?: Date | null
    updatedAt?: Date
  } = {}

  if (body.status !== undefined) {
    const next = String(body.status)
    if (!isAdminStatusTransitionAllowed(ticket.status, next)) {
      return NextResponse.json(
        { error: `Status change from ${ticket.status} to ${next} is not allowed.` },
        { status: 409 },
      )
    }
    updateData.status = next
    if (next === 'resolved') {
      updateData.resolvedAt = new Date()
      updateData.closedAt = null
    } else if (next === 'closed') {
      updateData.resolvedAt = updateData.resolvedAt ?? new Date()
      updateData.closedAt = new Date()
    } else {
      // Reopened (open) or active states clear the terminal timestamps.
      updateData.resolvedAt = null
      updateData.closedAt = null
    }
  }

  if (body.priority !== undefined) {
    const next = String(body.priority)
    if (!SUPPORT_TICKET_PRIORITIES.includes(next as never)) {
      return NextResponse.json({ error: 'Priority is not supported.' }, { status: 400 })
    }
    updateData.priority = next
  }

  if (body.assignedTo !== undefined) {
    const assigneeId = typeof body.assignedTo === 'string' && body.assignedTo.trim() ? body.assignedTo.trim() : null
    if (assigneeId) {
      const assignee = await prisma.user.findFirst({ where: { id: assigneeId, role: 'ADMIN' } })
      if (!assignee) {
        return NextResponse.json({ error: 'Assignee must be an admin.' }, { status: 400 })
      }
    }
    updateData.assignedTo = assigneeId
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No supported changes provided.' }, { status: 400 })
  }

  const updated = await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: { ...updateData, updatedAt: new Date() },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      messages: { orderBy: { createdAt: 'asc' } },
    },
  })

  return NextResponse.json({
    success: true,
    ticket: toSupportTicketDto(updated, updated.messages.length),
    broker: updated.user,
    messages: await withSenderNames(updated.messages, prisma),
  })
}