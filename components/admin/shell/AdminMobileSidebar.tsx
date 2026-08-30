'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Logo } from '@/components/shared/Logo'
import { adminNavigation, isAdminNavItemActive } from '@/lib/admin/navigation'
import { AdminNavItem } from './AdminNavItem'

export function AdminMobileSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname()

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="left" className="w-80 p-0">
        <div className="flex h-16 items-center justify-between border-b px-6">
          <Link href="/admin" className="flex items-center gap-2">
            <Logo className="h-6" />
          </Link>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close navigation">
            <X className="h-5 w-5" />
          </Button>
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
      </SheetContent>
    </Sheet>
  )
}
