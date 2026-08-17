import type { CompanyAdRequestStatus } from '@prisma/client'

// Canonical status metadata for company advertisement requests. Labels and
// descriptions are human-friendly and consistent across the admin + company UI.
export const REQUEST_STATUS_META: Record<
  CompanyAdRequestStatus,
  { label: string; description: string; tone: 'slate' | 'blue' | 'green' | 'red' | 'amber' | 'zinc' }
> = {
  REQUESTED: { label: 'Requested', description: 'Waiting for admin review', tone: 'slate' },
  UNDER_REVIEW: { label: 'Under Review', description: 'Admin is reviewing this request', tone: 'blue' },
  APPROVED: { label: 'Approved', description: 'Request approved — advertisement can be created', tone: 'green' },
  REJECTED: { label: 'Rejected', description: 'Request was rejected', tone: 'red' },
  FULFILLED: { label: 'Fulfilled', description: 'Advertisement has been created and fulfilled', tone: 'green' },
  CANCELED: { label: 'Canceled', description: 'Request canceled', tone: 'zinc' },
}

export const REQUEST_STATUS_ORDER: CompanyAdRequestStatus[] = [
  'REQUESTED',
  'UNDER_REVIEW',
  'APPROVED',
  'FULFILLED',
]

export const REQUEST_STATUSES = Object.keys(REQUEST_STATUS_META) as CompanyAdRequestStatus[]

export function requestStatusLabel(status: CompanyAdRequestStatus): string {
  return REQUEST_STATUS_META[status]?.label ?? status
}

export type RequestTargetLocation = {
  locationLabel?: string
  city?: string
  state?: string
  zip?: string
  radiusMiles?: number | null
}

export function formatRequestTargetLocation(location: RequestTargetLocation | null | undefined): string {
  if (!location) return '—'
  const parts: string[] = []
  if (location.locationLabel) parts.push(location.locationLabel)
  else if (location.city) parts.push([location.city, location.state].filter(Boolean).join(', '))
  if (location.zip) parts.push(location.zip)
  const base = parts.join(' · ') || '—'
  if (location.radiusMiles && location.radiusMiles > 0) return `${base} · ${location.radiusMiles} mile radius`
  return base
}
