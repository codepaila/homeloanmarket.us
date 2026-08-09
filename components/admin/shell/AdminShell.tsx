'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { adminNavigation } from '@/lib/admin/navigation'
import { AdminHeader } from './AdminHeader'
import { AdminMobileSidebar } from './AdminMobileSidebar'
import { AdminSidebar } from './AdminSidebar'

function pageTitle(pathname: string) {
  const groups = adminNavigation.flatMap((group) => group.items)
  const match = groups.find((item) => item.href && (pathname === item.href || pathname.startsWith(`${item.href}/`)))
  if (match) return match.label
  if (pathname.startsWith('/admin/ads')) return 'Advertisements'
  if (pathname.startsWith('/admin/brokers')) return 'Brokers'
  if (pathname.startsWith('/admin/media')) return 'Media'
  if (pathname.startsWith('/admin/folders')) return 'Folders'
  return 'Admin'
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const title = pageTitle(pathname)

  return (
    <div className="flex min-h-screen bg-muted">
      <AdminSidebar className="fixed inset-y-0 left-0 z-50 hidden w-72 lg:flex" />
      <AdminMobileSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col lg:pl-72">
        <AdminHeader onMenuClick={() => setSidebarOpen(true)} title={title} />
        <main className="flex-1 pb-8">
          <div className="px-4 py-8 sm:px-6 lg:px-8">
            <div>{children}</div>
          </div>
        </main>
      </div>
    </div>
  )
}
