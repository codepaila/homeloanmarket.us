'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { AdminNavItem } from '@/lib/admin/navigation'

export function AdminNavItem({ item, active, isChild }: { item: AdminNavItem; active: boolean; isChild?: boolean }) {
  const Icon = item.icon

  if (item.disabled || !item.href) {
    return (
      <span
        className={cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground/70',
          isChild && 'ml-4',
        )}
        title="Coming soon"
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span>{item.label}</span>
        <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground/50">Soon</span>
      </span>
    )
  }

  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        isChild && 'ml-4',
        active
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
      aria-current={active ? 'page' : undefined}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{item.label}</span>
    </Link>
  )
}
