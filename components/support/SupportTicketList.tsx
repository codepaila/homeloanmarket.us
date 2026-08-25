'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TicketStatusBadge } from '@/components/support/StatusBadge'
import { TicketPriorityBadge } from '@/components/support/PriorityBadge'
import {
  SUPPORT_TICKET_CATEGORY_LABELS,
  SUPPORT_TICKET_STATUSES,
  SUPPORT_TICKET_STATUS_LABELS,
} from '@/lib/support-ticket-constants'
import type { SupportTicketDto } from '@/lib/support-ticket'

function Pagination({ page, totalPages, basePath }: { page: number; totalPages: number; basePath: string }) {
  const searchParams = useSearchParams()
  const href = (target: number) => {
    const next = new URLSearchParams(searchParams.toString())
    next.set('page', String(target))
    return `${basePath}?${next.toString()}`
  }
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between pt-4">
      <p className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} asChild={page > 1}>
          {page > 1 ? <Link href={href(page - 1)}>Previous</Link> : <span>Previous</span>}
        </Button>
        <Button variant="outline" size="sm" disabled={page >= totalPages} asChild={page < totalPages}>
          {page < totalPages ? <Link href={href(page + 1)}>Next</Link> : <span>Next</span>}
        </Button>
      </div>
    </div>
  )
}

export function SupportTicketList({
  tickets,
  page,
  totalPages,
  search,
  status,
}: {
  tickets: SupportTicketDto[]
  page: number
  totalPages: number
  search: string
  status?: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const setFilter = (key: 'search' | 'status', value: string) => {
    const next = new URLSearchParams(searchParams.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    next.delete('page')
    router.push(`/broker/support/tickets?${next.toString()}`)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
          <input
            placeholder="Search by subject or ticket number..."
            defaultValue={search}
            onKeyDown={(event) => {
              if (event.key === 'Enter') setFilter('search', event.currentTarget.value)
            }}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:max-w-xs focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <select
            value={status || 'all'}
            onChange={(event) => setFilter('status', event.target.value === 'all' ? '' : event.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All statuses</option>
            {SUPPORT_TICKET_STATUSES.map((s) => (
              <option key={s} value={s}>{SUPPORT_TICKET_STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
        <Button asChild>
          <Link href="/broker/support/tickets/create">
            <Plus className="mr-2 h-4 w-4" />
            Create Ticket
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {tickets.length === 0 ? (
            <div className="py-14 text-center">
              <p className="text-sm font-medium text-foreground">No support tickets found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {search || status ? 'Try changing your filters, or' : 'When you create a ticket it will appear here.'}
              </p>
              <Button asChild className="mt-4">
                <Link href="/broker/support/tickets/create">
                  <Plus className="mr-2 h-4 w-4" />
                  Create a ticket
                </Link>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-3 pl-5 pr-4 font-medium">Ticket</th>
                    <th className="py-3 px-4 font-medium">Subject</th>
                    <th className="py-3 px-4 font-medium">Category</th>
                    <th className="py-3 px-4 font-medium">Priority</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                    <th className="py-3 px-4 font-medium">Updated</th>
                    <th className="py-3 pl-4 pr-5 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr key={ticket.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="py-3 pl-5 pr-4 font-medium tabular-nums">{ticket.ticketNumber}</td>
                      <td className="max-w-[280px] py-3 px-4">
                        <p className="truncate font-medium">{ticket.subject}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {ticket.messageCount} {ticket.messageCount === 1 ? 'reply' : 'replies'}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="secondary">{SUPPORT_TICKET_CATEGORY_LABELS[ticket.category] ?? ticket.category}</Badge>
                      </td>
                      <td className="py-3 px-4"><TicketPriorityBadge priority={ticket.priority} /></td>
                      <td className="py-3 px-4"><TicketStatusBadge status={ticket.status} /></td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {new Date(ticket.updatedAt).toLocaleDateString()}
                        {ticket.lastMessageAt ? (
                          <p className="text-xs">Last reply {new Date(ticket.lastMessageAt).toLocaleDateString()}</p>
                        ) : null}
                      </td>
                      <td className="py-3 pl-4 pr-5">
                        <div className="flex justify-end">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/broker/support/tickets/${ticket.id}`}>
                              View
                              <ArrowRight className="ml-1 h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Pagination page={page} totalPages={totalPages} basePath="/broker/support/tickets" />
    </div>
  )
}