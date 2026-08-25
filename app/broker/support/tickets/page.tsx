import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getCurrentUser } from '@/lib/currentUser'
import prisma from '@/lib/prisma'
import { SupportTicketList } from '@/components/support/SupportTicketList'
import { normalizeTicketFilters, toSupportTicketListItem } from '@/lib/support-ticket'

export const metadata: Metadata = {
  title: 'My Support Tickets',
  robots: { index: false, follow: false },
}

export default async function BrokerSupportTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string; page?: string }>
}) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'BROKER') {
    redirect('/auth/signin')
  }

  const params = await searchParams
  const filters = normalizeTicketFilters({
    status: params.status ?? null,
    search: params.search ?? null,
    page: params.page ?? null,
    pageSize: '10',
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
      include: { messages: { select: { createdAt: true }, orderBy: { createdAt: 'asc' } } },
      orderBy: { updatedAt: 'desc' },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.supportTicket.count({ where }),
  ])

  return (
    <SupportTicketList
      tickets={tickets.map(toSupportTicketListItem)}
      page={filters.page}
      totalPages={Math.max(1, Math.ceil(total / filters.pageSize))}
      search={filters.search ?? ''}
      status={filters.status}
    />
  )
}