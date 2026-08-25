// lib/support-ticket.ts
//
// Server-side domain logic for the support ticket system. Reuses the existing
// Prisma `SupportTicket` / `SupportMessage` models. Client-safe constants live
// in lib/support-ticket-constants.ts.
import crypto from 'crypto'
import {
  SUPPORT_TICKET_CATEGORIES,
  SUPPORT_TICKET_PRIORITIES,
  SUPPORT_TICKET_STATUSES,
} from '@/lib/support-ticket-constants'

export {
  SUPPORT_TICKET_CATEGORIES,
  SUPPORT_TICKET_CATEGORY_LABELS,
  SUPPORT_TICKET_PRIORITIES,
  SUPPORT_TICKET_PRIORITY_LABELS,
  SUPPORT_TICKET_STATUSES,
  SUPPORT_TICKET_STATUS_LABELS,
  canBrokerReply,
  type SupportTicketCategory,
  type SupportTicketPriority,
  type SupportTicketStatus,
} from '@/lib/support-ticket-constants'

// ---------------------------------------------------------------------------
// Status workflow (admin-controlled)
// ---------------------------------------------------------------------------

const ADMIN_STATUS_TRANSITIONS: Record<string, string[]> = {
  open: ['in_progress', 'resolved', 'closed'],
  in_progress: ['waiting_for_broker', 'resolved', 'closed'],
  waiting_for_broker: ['in_progress', 'resolved', 'closed'],
  resolved: ['closed', 'open'],
  closed: ['open'],
}

export function isAdminStatusTransitionAllowed(from: string | undefined | null, to: string | undefined | null): boolean {
  if (!from || !to || from === to) return false
  return (ADMIN_STATUS_TRANSITIONS[from] ?? []).includes(to)
}

/** Broker reply moves a waiting ticket back to in_progress. */
export function brokerReplyNextStatus(current: string | undefined | null): string {
  return current === 'waiting_for_broker' ? 'in_progress' : (current ?? 'open')
}

/** Admin reply moves an active ticket to waiting_for_broker. */
export function adminReplyNextStatus(current: string | undefined | null): string {
  return ['open', 'in_progress', 'waiting_for_broker'].includes(current ?? '') ? 'waiting_for_broker' : (current ?? 'open')
}

// ---------------------------------------------------------------------------
// Ticket number generation
// ---------------------------------------------------------------------------

export function generateTicketNumber(): string {
  const stamp = Date.now().toString(36).toUpperCase()
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase()
  return `TKT-${stamp}${rand}`
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

export type TicketCreateInput = {
  subject?: unknown
  category?: unknown
  priority?: unknown
  description?: unknown
}

export function validateTicketCreateInput(input: TicketCreateInput): string | null {
  const subject = typeof input.subject === 'string' ? input.subject.trim() : ''
  if (!subject) return 'Subject is required.'
  if (subject.length > 200) return 'Subject must be 200 characters or fewer.'

  const category = typeof input.category === 'string' ? input.category : ''
  if (!SUPPORT_TICKET_CATEGORIES.includes(category as never)) {
    return 'Category is not supported.'
  }

  const priority = typeof input.priority === 'string' ? input.priority : ''
  if (!SUPPORT_TICKET_PRIORITIES.includes(priority as never)) {
    return 'Priority is not supported.'
  }

  const description = typeof input.description === 'string' ? input.description.trim() : ''
  if (!description) return 'Description is required.'
  if (description.length > 5000) return 'Description must be 5000 characters or fewer.'

  return null
}

export function validateTicketReply(message: unknown): string | null {
  const text = typeof message === 'string' ? message.trim() : ''
  if (!text) return 'Message is required.'
  if (text.length > 5000) return 'Message must be 5000 characters or fewer.'
  return null
}

export function normalizeTicketFilters(filters: { status?: string | null; priority?: string | null; category?: string | null; search?: string | null; page?: string | null; pageSize?: string | null }) {
  const status = filters.status && SUPPORT_TICKET_STATUSES.includes(filters.status as never) ? filters.status : undefined
  const priority = filters.priority && SUPPORT_TICKET_PRIORITIES.includes(filters.priority as never) ? filters.priority : undefined
  const category = filters.category && SUPPORT_TICKET_CATEGORIES.includes(filters.category as never) ? filters.category : undefined
  const search = filters.search?.trim() || undefined
  const rawPage = filters.page ? Number.parseInt(filters.page, 10) : 1
  const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1
  const rawPageSize = filters.pageSize ? Number.parseInt(filters.pageSize, 10) : 10
  const pageSize = Number.isInteger(rawPageSize) ? Math.min(Math.max(rawPageSize, 1), 50) : 10
  return { status, priority, category, search, page, pageSize }
}

// ---------------------------------------------------------------------------
// DTOs (safe, no internal fields)
// ---------------------------------------------------------------------------

export type SupportTicketDto = {
  id: string
  ticketNumber: string
  subject: string
  category: string
  priority: string
  status: string
  description: string
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
  closedAt: string | null
  lastMessageAt: string | null
  messageCount: number
}

export type SupportMessageDto = {
  id: string
  senderId: string
  senderType: string
  message: string
  createdAt: string
  senderName: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toSupportTicketDto(ticket: any, messageCount = 0, lastMessageAt: Date | null = null): SupportTicketDto {
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    subject: ticket.subject,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status,
    description: ticket.description,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    resolvedAt: ticket.resolvedAt ? ticket.resolvedAt.toISOString() : null,
    closedAt: ticket.closedAt ? ticket.closedAt.toISOString() : null,
    lastMessageAt: lastMessageAt ? lastMessageAt.toISOString() : null,
    messageCount,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toSupportMessageDto(message: any, senderName: string | null = null): SupportMessageDto {
  return {
    id: message.id,
    senderId: message.senderId,
    senderType: message.senderType,
    message: message.message,
    createdAt: message.createdAt.toISOString(),
    senderName: message.sender?.name ?? senderName,
  }
}

/** Ticket list item used by broker and admin list pages. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toSupportTicketListItem(ticket: any): SupportTicketDto {
  const messages = ticket.messages ?? []
  const lastMessageAt = messages.length > 0 ? messages[messages.length - 1].createdAt : null
  return toSupportTicketDto(ticket, messages.length, lastMessageAt)
}