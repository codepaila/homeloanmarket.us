// app/dashboard/layout.tsx
'use client'

import { useState } from 'react'
import { useSidebarData } from '@/hooks/useSidebarData'
import { useUserPermissions } from '@/hooks/useCurrentUser'
import { DashboardSidebar } from '@/components/layout/admin/Sidebar'
import { MobileSidebar } from '@/components/layout/admin/MobileSidebar'
import { Breadcrumbs } from '@/components/layout/admin/Breadcrumbs'
import { DashboardHeader } from '@/components/layout/admin/DashboardHeader'

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const sidebarData = useSidebarData()
  const permissions = useUserPermissions()

  return (
    <div className="flex min-h-screen bg-muted">
      {/* Desktop Sidebar */}
      <DashboardSidebar 
        data={sidebarData}
        permissions={permissions}
        className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col"
      />

      {/* Mobile Sidebar */}
      <MobileSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        data={sidebarData}
        permissions={permissions}
      />

      {/* Main Content */}
      <div className="lg:pl-72 flex flex-col flex-1">
        <DashboardHeader 
          onMenuClick={() => setSidebarOpen(true)}
          quickActions={sidebarData.quickActions}
          user={sidebarData.user}
        />

        <main className="flex-1 pb-8">
          <div className="px-4 sm:px-6 lg:px-8 py-8">
            {/* Breadcrumbs */}
            {/* <Breadcrumbs /> */}
            
            {/* Page Content */}
            <div className="mt-6">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}