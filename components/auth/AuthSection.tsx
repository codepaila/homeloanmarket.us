import { cn } from '@/lib/utils'

export function AuthSection({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('space-y-4', className)} aria-label={title}>
      <div className="flex items-center gap-3">
        <h2 className="shrink-0 text-xs font-semibold uppercase tracking-wider text-text-muted">
          {title}
        </h2>
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
      </div>
      {description && <p className="text-xs text-text-muted">{description}</p>}
      <div className="space-y-4">{children}</div>
    </section>
  )
}
