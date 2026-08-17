'use client'

import { cn } from '@/lib/utils'
import { REQUEST_STATUS_META } from '@/lib/advertisements/request-status'
import type { CompanyAdRequestStatus } from '@prisma/client'

const TONE_CLASSES: Record<string, string> = {
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  blue: 'bg-blue-100 text-blue-700 ring-blue-200',
  green: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  red: 'bg-red-100 text-red-700 ring-red-200',
  amber: 'bg-amber-100 text-amber-700 ring-amber-200',
  zinc: 'bg-zinc-100 text-zinc-600 ring-zinc-200',
}

export function RequestStatusBadge({
  status,
  title,
  className,
}: {
  status: CompanyAdRequestStatus
  title?: string
  className?: string
}) {
  const meta = REQUEST_STATUS_META[status]
  const label = meta?.label ?? status
  const description = title === undefined ? meta?.description : title
  return (
    <span
      title={description}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
        TONE_CLASSES[meta?.tone ?? 'zinc'],
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {label}
    </span>
  )
}
