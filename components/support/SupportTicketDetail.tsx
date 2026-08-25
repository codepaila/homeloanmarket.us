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
  SUPPORT_TICKET_STATUS_LABELS,
} from '@/lib/support-ticket-constants'
import { canBrokerReply } from '@/lib/support-ticket'
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

export function SupportTicketDetail({
  ticket,
  messages,
}: {
  ticket: SupportTicketDto
  messages: SupportMessageDto[]
}) {
  const router = useRouter()
  const [reply, setReply] = useState('')
  const [isSending, setIsSending] = useState(false)
  const canReply = canBrokerReply(ticket.status)

  const handleReply = async () => {
    if (!reply.trim() || isSending) return
    setIsSending(true)
    try {
      const response = await fetch(`/api/support/tickets/${ticket.id}/messages`, {
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

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/broker/support/tickets">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to My Tickets
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>{ticket.subject}</CardTitle>
              <CardDescription className="mt-1">
                {ticket.ticketNumber} · Created {formatDate(ticket.createdAt)}
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
                          <span className="text-sm font-medium">{message.senderName || (fromBroker ? 'You' : 'Support')}</span>
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

          {canReply ? (
            <div className="border-t pt-4">
              <Textarea
                placeholder="Write your reply..."
                rows={4}
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                className="resize-none"
              />
              <div className="mt-3 flex justify-end">
                <Button onClick={handleReply} disabled={isSending || !reply.trim()}>
                  <Send className="mr-2 h-4 w-4" />
                  {isSending ? 'Sending...' : 'Send Reply'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">
              This ticket is {SUPPORT_TICKET_STATUS_LABELS[ticket.status]?.toLowerCase() ?? ticket.status} and no longer accepts replies.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}