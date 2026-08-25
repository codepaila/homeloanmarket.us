import { Badge } from '@/components/ui/badge'
import { SUPPORT_TICKET_PRIORITY_LABELS } from '@/lib/support-ticket'

const PRIORITY_STYLES: Record<string, string> = {
  low: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  high: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
}

export function TicketPriorityBadge({ priority }: { priority: string }) {
  return (
    <Badge variant="secondary" className={PRIORITY_STYLES[priority] ?? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}>
      {SUPPORT_TICKET_PRIORITY_LABELS[priority] ?? priority}
    </Badge>
  )
}