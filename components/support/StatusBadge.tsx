import { Badge } from '@/components/ui/badge'
import { SUPPORT_TICKET_STATUS_LABELS } from '@/lib/support-ticket'

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  in_progress: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  waiting_for_broker: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
  resolved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  closed: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
}

export function TicketStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="secondary" className={STATUS_STYLES[status] ?? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}>
      {SUPPORT_TICKET_STATUS_LABELS[status] ?? status}
    </Badge>
  )
}