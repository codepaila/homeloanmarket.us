import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/currentUser'
import { normalizeTicketFilters, toSupportTicketListItem } from '@/lib/support-ticket'

async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return null
  return user
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const filters = normalizeTicketFilters({
    status: searchParams.get('status'),
    priority: searchParams.get('priority'),
    category: searchParams.get('category'),
    search: searchParams.get('search'),
    page: searchParams.get('page'),
    pageSize: searchParams.get('pageSize'),
  })

  const where = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.priority ? { priority: filters.priority } : {}),
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.search
      ? {
          OR: [
            { subject: { contains: filters.search, mode: 'insensitive' as const } },
            { ticketNumber: { contains: filters.search, mode: 'insensitive' as const } },
            { user: { name: { contains: filters.search, mode: 'insensitive' as const } } },
            { user: { email: { contains: filters.search, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
  }

  const [tickets, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        messages: { select: { createdAt: true }, orderBy: { createdAt: 'asc' } },
      },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.supportTicket.count({ where }),
  ])

  return NextResponse.json({
    tickets: tickets.map((ticket) => ({
      ...toSupportTicketListItem(ticket),
      broker: ticket.user ? { id: ticket.user.id, name: ticket.user.name, email: ticket.user.email } : null,
    })),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
  })
}