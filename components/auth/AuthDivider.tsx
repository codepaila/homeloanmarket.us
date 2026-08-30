import { cn } from '@/lib/utils'

export function AuthDivider({
  label = 'or',
  className,
}: {
  label?: string
  className?: string
}) {
  return (
    <div
      role="separator"
      aria-label={label}
      className={cn('flex items-center gap-3 text-xs text-muted-foreground', className)}
    >
      <span className="h-px flex-1 bg-border" aria-hidden="true" />
      <span className="shrink-0">{label}</span>
      <span className="h-px flex-1 bg-border" aria-hidden="true" />
    </div>
  )
}
