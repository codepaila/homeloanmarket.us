'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TicketStatusBadge } from '@/components/support/StatusBadge'
import { TicketPriorityBadge } from '@/components/support/PriorityBadge'
import {
  SUPPORT_TICKET_CATEGORIES,
  SUPPORT_TICKET_CATEGORY_LABELS,
  SUPPORT_TICKET_PRIORITIES,
  SUPPORT_TICKET_PRIORITY_LABELS,
  SUPPORT_TICKET_STATUSES,
  SUPPORT_TICKET_STATUS_LABELS,
} from '@/lib/support-ticket-constants'
import type { SupportTicketDto } from '@/lib/support-ticket'

type AdminTicketRow = SupportTicketDto & {
  broker: { id: string; name: string | null; email: string | null } | null
}

export function AdminSupportTicketList({
  tickets,
  page,
  totalPages,
  search,
  status,
  priority,
  category,
}: {
  tickets: AdminTicketRow[]
  page: number
  totalPages: number
  search: string
  status?: string
  priority?: string
  category?: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    next.delete('page')
    router.push(`/admin/support/tickets?${next.toString()}`)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <input
          placeholder="Search by subject, ticket number, or broker..."
          defaultValue={search}
          onKeyDown={(event) => {
            if (event.key === 'Enter') setFilter('search', event.currentTarget.value)
          }}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:max-w-xs focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex flex-wrap gap-2">
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
          <select
            value={priority || 'all'}
            onChange={(event) => setFilter('priority', event.target.value === 'all' ? '' : event.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All priorities</option>
            {SUPPORT_TICKET_PRIORITIES.map((p) => (
              <option key={p} value={p}>{SUPPORT_TICKET_PRIORITY_LABELS[p]}</option>
            ))}
          </select>
          <select
            value={category || 'all'}
            onChange={(event) => setFilter('category', event.target.value === 'all' ? '' : event.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All categories</option>
            {SUPPORT_TICKET_CATEGORIES.map((c) => (
              <option key={c} value={c}>{SUPPORT_TICKET_CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {tickets.length === 0 ? (
            <p className="py-14 text-center text-sm text-muted-foreground">No support tickets found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-3 pl-5 pr-4 font-medium">Ticket</th>
                    <th className="py-3 px-4 font-medium">Broker</th>
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
                      <td className="max-w-[180px] py-3 px-4">
                        <p className="truncate font-medium">{ticket.broker?.name || '—'}</p>
                        {ticket.broker?.email && (
                          <p className="truncate text-xs text-muted-foreground">{ticket.broker.email}</p>
                        )}
                      </td>
                      <td className="max-w-[240px] py-3 px-4">
                        <p className="truncate font-medium">{ticket.subject}</p>
                        <p className="text-xs text-muted-foreground">{ticket.messageCount} replies</p>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="secondary">{SUPPORT_TICKET_CATEGORY_LABELS[ticket.category] ?? ticket.category}</Badge>
                      </td>
                      <td className="py-3 px-4"><TicketPriorityBadge priority={ticket.priority} /></td>
                      <td className="py-3 px-4"><TicketStatusBadge status={ticket.status} /></td>
                      <td className="py-3 px-4 text-muted-foreground">{new Date(ticket.updatedAt).toLocaleDateString()}</td>
                      <td className="py-3 pl-4 pr-5">
                        <div className="flex justify-end">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/admin/support/tickets/${ticket.id}`}>
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} asChild={page > 1}>
              {page > 1 ? <Link href={`/admin/support/tickets?${new URLSearchParams({ ...Object.fromEntries(searchParams.entries()), page: String(page - 1) }).toString()}`}>Previous</Link> : <span>Previous</span>}
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} asChild={page < totalPages}>
              {page < totalPages ? <Link href={`/admin/support/tickets?${new URLSearchParams({ ...Object.fromEntries(searchParams.entries()), page: String(page + 1) }).toString()}`}>Next</Link> : <span>Next</span>}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}