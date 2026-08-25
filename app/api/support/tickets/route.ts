import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/currentUser'
import { isSameOriginRequest } from '@/lib/origin'
import { sendSupportTicketNotification } from '@/actions/email.action'
import {
  generateTicketNumber,
  normalizeTicketFilters,
  toSupportTicketListItem,
  validateTicketCreateInput,
  type TicketCreateInput,
} from '@/lib/support-ticket'

async function requireBroker() {
  const user = await getCurrentUser()
  if (!user) return null
  if (user.role !== 'BROKER') return null
  return user
}

function notifyAdmins(title: string, message: string) {
  // Best-effort admin notification; never fails the ticket operation.
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

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }
  const user = await requireBroker()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: TicketCreateInput
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const validationError = validateTicketCreateInput(body)
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 })
  }

  const subject = String(body.subject).trim()
  const description = String(body.description).trim()
  const category = String(body.category)
  const priority = String(body.priority)

  // Ownership is derived from the authenticated session — never from the body.
  let ticket
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      ticket = await prisma.supportTicket.create({
        data: {
          userId: user.id,
          ticketNumber: generateTicketNumber(),
          category,
          subject,
          description,
          priority,
          status: 'open',
        },
      })
      break
    } catch (error) {
      // Retry only on a ticket-number collision.
      if (attempt < 2 && (error as { code?: string })?.code === 'P2002') continue
      throw error
    }
  }

  if (!ticket) {
    return NextResponse.json({ error: 'Unable to create support ticket' }, { status: 500 })
  }

  // Existing application integrations: admin notification + ticket email.
  await notifyAdmins('New support ticket', `Ticket ${ticket.ticketNumber}: ${ticket.subject}`)
  try {
    await sendSupportTicketNotification(ticket.id)
  } catch {
    // Email delivery must not fail ticket creation.
  }

  return NextResponse.json(
    { success: true, ticket: toSupportTicketListItem({ ...ticket, messages: [] }) },
    { status: 201 },
  )
}

export async function GET(request: NextRequest) {
  const user = await requireBroker()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const filters = normalizeTicketFilters({
    status: searchParams.get('status'),
    search: searchParams.get('search'),
    page: searchParams.get('page'),
    pageSize: searchParams.get('pageSize'),
  })

  const where = {
    userId: user.id,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.search
      ? {
          OR: [
            { subject: { contains: filters.search, mode: 'insensitive' as const } },
            { ticketNumber: { contains: filters.search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }

  const [tickets, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      include: { messages: { select: { createdAt: true } } },
      orderBy: { updatedAt: 'desc' },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.supportTicket.count({ where }),
  ])

  return NextResponse.json({
    tickets: tickets.map(toSupportTicketListItem),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
  })
}