'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import Link from 'next/link'
import { ArrowLeft, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { TicketStatusBadge } from '@/components/support/StatusBadge'
import { TicketPriorityBadge } from '@/components/support/PriorityBadge'
import {
  SUPPORT_TICKET_CATEGORY_LABELS,
  SUPPORT_TICKET_PRIORITIES,
  SUPPORT_TICKET_PRIORITY_LABELS,
  SUPPORT_TICKET_STATUS_LABELS,
} from '@/lib/support-ticket-constants'
import type { SupportMessageDto, SupportTicketDto } from '@/lib/support-ticket'

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function AdminSupportTicketDetail({
  ticket,
  broker,
  messages,
  admins,
  assignedTo,
  allowedStatuses,
}: {
  ticket: SupportTicketDto
  broker: { id: string; name: string | null; email: string | null; phone: string | null } | null
  messages: SupportMessageDto[]
  admins: Array<{ id: string; name: string | null; email: string | null }>
  assignedTo: string | null
  allowedStatuses: string[]
}) {
  const router = useRouter()
  const [reply, setReply] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [status, setStatus] = useState<string>(ticket.status)
  const [priority, setPriority] = useState<string>(ticket.priority)
  const [assigneeId, setAssigneeId] = useState<string>(assignedTo || '')
  const [isSaving, setIsSaving] = useState(false)

  const handleReply = async () => {
    if (!reply.trim() || isSending) return
    setIsSending(true)
    try {
      const response = await fetch(`/api/admin/support/tickets/${ticket.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: reply }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Unable to send reply')
      }
      setReply('')
      toast.success('Reply sent')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to send reply')
    } finally {
      setIsSending(false)
    }
  }

  const handleSave = async () => {
    if (isSaving) return
    setIsSaving(true)
    try {
      const payload: Record<string, string> = {}
      if (status !== ticket.status) payload.status = status
      if (priority !== ticket.priority) payload.priority = priority
      if ((assigneeId || null) !== (assignedTo || null)) payload.assignedTo = assigneeId || ''
      if (Object.keys(payload).length === 0) {
        toast('No changes to save')
        return
      }
      const response = await fetch(`/api/admin/support/tickets/${ticket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Unable to update ticket')
      }
      toast.success('Ticket updated')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update ticket')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/admin/support/tickets">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Support Tickets
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>{ticket.subject}</CardTitle>
              <CardDescription className="mt-1">
                {ticket.ticketNumber} · Created {formatDate(ticket.createdAt)} · Updated {formatDate(ticket.updatedAt)}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{SUPPORT_TICKET_CATEGORY_LABELS[ticket.category] ?? ticket.category}</Badge>
              <TicketPriorityBadge priority={ticket.priority} />
              <TicketStatusBadge status={ticket.status} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {broker && (
            <div className="rounded-lg border bg-muted/40 p-4">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Broker</p>
              <p className="text-sm font-medium">{broker.name || '—'}</p>
              {broker.email && <p className="text-sm text-muted-foreground">{broker.email}</p>}
              {broker.phone && <p className="text-sm text-muted-foreground">{broker.phone}</p>}
            </div>
          )}

          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Description</p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{ticket.description}</p>
          </div>

          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Conversation</p>
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No replies yet.</p>
            ) : (
              <div className="space-y-3">
                {messages.map((message) => {
                  const fromBroker = message.senderType === 'user'
                  return (
                    <div key={message.id} className={`rounded-lg border p-4 ${fromBroker ? 'bg-muted/40' : 'bg-primary/5'}`}>
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{message.senderName || (fromBroker ? 'Broker' : 'Support')}</span>
                          <Badge variant="secondary" className="text-[10px]">{fromBroker ? 'Broker' : 'Support'}</Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">{formatDate(message.createdAt)}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.message}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="rounded-lg border p-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Manage ticket</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Status</label>
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {allowedStatuses.length > 0 ? (
                    allowedStatuses.map((s) => (
                      <option key={s} value={s}>{SUPPORT_TICKET_STATUS_LABELS[s]}</option>
                    ))
                  ) : (
                    <option value={ticket.status}>{SUPPORT_TICKET_STATUS_LABELS[ticket.status] ?? ticket.status} (no transitions)</option>
                  )}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">From {SUPPORT_TICKET_STATUS_LABELS[ticket.status] ?? ticket.status}</p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Priority</label>
                <select
                  value={priority}
                  onChange={(event) => setPriority(event.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {SUPPORT_TICKET_PRIORITIES.map((p) => (
                    <option key={p} value={p}>{SUPPORT_TICKET_PRIORITY_LABELS[p]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Assigned admin</label>
                <select
                  value={assigneeId}
                  onChange={(event) => setAssigneeId(event.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Unassigned</option>
                  {admins.map((admin) => (
                    <option key={admin.id} value={admin.id}>{admin.name || admin.email}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <Button variant="outline" size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>

          <div className="border-t pt-4">
            <Textarea
              placeholder="Write a reply to the broker..."
              rows={4}
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              className="resize-none"
            />
            <div className="mt-3 flex justify-end">
              <Button onClick={handleReply} disabled={isSending || !reply.trim()}>
                <Send className="mr-2 h-4 w-4" />
                {isSending ? 'Sending...' : 'Reply to Broker'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}