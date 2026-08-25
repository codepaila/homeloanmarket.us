// lib/support-ticket-constants.ts
//
// Client-safe domain constants for the support ticket system. No Node-only
// imports here so this can be imported by client components.

export const SUPPORT_TICKET_STATUSES = [
  'open',
  'in_progress',
  'waiting_for_broker',
  'resolved',
  'closed',
] as const

export const SUPPORT_TICKET_PRIORITIES = ['low', 'medium', 'high'] as const

export const SUPPORT_TICKET_CATEGORIES = [
  'account',
  'onboarding',
  'profile',
  'subscription',
  'messages',
  'technical_issue',
  'verification',
  'licensing',
  'other',
] as const

export const SUPPORT_TICKET_STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  waiting_for_broker: 'Waiting for Broker',
  resolved: 'Resolved',
  closed: 'Closed',
}

export const SUPPORT_TICKET_PRIORITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

export const SUPPORT_TICKET_CATEGORY_LABELS: Record<string, string> = {
  account: 'Account',
  onboarding: 'Onboarding',
  profile: 'Profile',
  subscription: 'Subscription',
  messages: 'Messages',
  technical_issue: 'Technical Issue',
  verification: 'Verification',
  licensing: 'Licensing',
  other: 'Other',
}

export type SupportTicketStatus = (typeof SUPPORT_TICKET_STATUSES)[number]
export type SupportTicketPriority = (typeof SUPPORT_TICKET_PRIORITIES)[number]
export type SupportTicketCategory = (typeof SUPPORT_TICKET_CATEGORIES)[number]

/** Broker replies are allowed while the ticket is being worked on. */
export function canBrokerReply(status: string | undefined | null): boolean {
  return ['open', 'in_progress', 'waiting_for_broker'].includes(status ?? '')
}