'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/shared/Logo'
import { adminNavigation, isAdminNavItemActive } from '@/lib/admin/navigation'
import { AdminNavItem } from './AdminNavItem'

export function AdminSidebar({ className }: { className?: string }) {
  const pathname = usePathname()

  return (
    <aside className={cn('flex flex-col border-r bg-sidebar', className)}>
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/admin" className="flex items-center gap-2">
          <Logo className="h-6" />
        </Link>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto py-4">
        {adminNavigation.map((group) => (
          <div key={group.label}>
            <div className="mb-2 px-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group.label}
            </div>
            <div className="space-y-1 px-3">
              {group.items.map((item) => (
                <AdminNavItem key={item.label} item={item} active={isAdminNavItemActive(pathname, item)} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t p-4">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-destructive"
          onClick={() => signOut({ callbackUrl: '/' })}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </aside>
  )
}
