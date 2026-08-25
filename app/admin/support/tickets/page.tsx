import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getCurrentUser } from '@/lib/currentUser'
import prisma from '@/lib/prisma'
import { AdminSupportTicketList } from '@/components/support/AdminSupportTicketList'
import { normalizeTicketFilters, toSupportTicketListItem } from '@/lib/support-ticket'

export const metadata: Metadata = {
  title: 'Support Tickets',
  robots: { index: false, follow: false },
}

export default async function AdminSupportTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; priority?: string; category?: string; search?: string; page?: string }>
}) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') {
    redirect('/auth/signin')
  }

  const params = await searchParams
  const filters = normalizeTicketFilters({
    status: params.status ?? null,
    priority: params.priority ?? null,
    category: params.category ?? null,
    search: params.search ?? null,
    page: params.page ?? null,
    pageSize: '10',
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

  const rows = tickets.map((ticket) => ({
    ...toSupportTicketListItem(ticket),
    broker: ticket.user ? { id: ticket.user.id, name: ticket.user.name, email: ticket.user.email } : null,
  }))

  return (
    <AdminSupportTicketList
      tickets={rows}
      page={filters.page}
      totalPages={Math.max(1, Math.ceil(total / filters.pageSize))}
      search={filters.search ?? ''}
      status={filters.status}
      priority={filters.priority}
      category={filters.category}
    />
  )
}