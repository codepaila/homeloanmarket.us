'use client'

import { useState } from 'react'
import { appSidebarData, type SidebarUserInput } from '@/components/layout/admin/sideBarData'
import { useSidebarData } from '@/hooks/useSidebarData'
import { useUserPermissions } from '@/hooks/useCurrentUser'
import { DashboardSidebar } from '@/components/layout/admin/DashboardSidebar'
import { MobileSidebar } from '@/components/layout/admin/MobileSidebar'
import { Breadcrumbs } from '@/components/layout/admin/Breadcrumbs'
import { DashboardHeader } from '@/components/layout/admin/DashboardHeader'
import type { UserRole } from '@prisma/client'

type SidebarUserInputData = NonNullable<SidebarUserInput>

// Structural shape satisfied by both the JWT session user and the
// database-backed user returned by getCurrentUser().
type BrokerLayoutUser = {
  id?: string
  name?: string | null
  email?: string | null
  phone?: string | null
  image?: string | null
  role?: UserRole
  isActive?: boolean
  isAdmin?: boolean
  isBroker?: boolean
  isUser?: boolean
  hasActiveSubscription?: boolean
  isVerifiedBroker?: boolean
  isFeaturedBroker?: boolean
  isPremiumBroker?: boolean
  subscription?: { plan?: string; isActive?: boolean; startDate?: Date; endDate?: Date | null } | null
  brokerProfile?: SidebarUserInputData['brokerProfile']
}

// The broker sidebar must reflect the authoritative database role (the same
// source the broker pages use via getCurrentUser()), not the JWT/session role.
// Reading the role from the JWT client session can lag the database after a
// claim/role promotion and, on a fresh client navigation, can briefly be null
// during useSession hydration -- either way the broker navigation would
// disappear even though the page itself renders. The server layout supplies the
// DB-backed user; we fall back to the JWT session only when it is unavailable.
function buildServerSidebarData(user: BrokerLayoutUser) {
  const data = appSidebarData(user as unknown as SidebarUserInput)
  return {
    ...data,
    canAccessAdmin: user.isAdmin,
    canAccessBroker: user.isBroker,
    canAccessBorrower: user.isUser,
    showBrokerFeatures: user.isBroker && user.hasActiveSubscription,
    showPremiumFeatures: user.isPremiumBroker,
  }
}

export default function BrokerLayoutClient({
  children,
  user,
}: {
  children: React.ReactNode
  user?: BrokerLayoutUser | null
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const fallbackData = useSidebarData()
  const fallbackPermissions = useUserPermissions()
  const serverPermissions = useUserPermissions(user ?? null)

  const sidebarData = user ? buildServerSidebarData(user) : fallbackData
  const permissions = user ? serverPermissions : fallbackPermissions

  return (
    <div className="flex min-h-screen bg-muted">
      <DashboardSidebar data={sidebarData} permissions={permissions} className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col" />
      <MobileSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} data={sidebarData} permissions={permissions} />
      <div className="lg:pl-72 flex flex-col flex-1">
        <DashboardHeader onMenuClick={() => setSidebarOpen(true)} quickActions={sidebarData.quickActions} user={sidebarData.user} />
        <main className="flex-1 pb-8">
          <div className="px-3 sm:px-4 lg:px-6 py-4">
            {/* <Breadcrumbs /> */}
            <div className="mt-0">{children}</div>
          </div>
        </main>
      </div>
    </div>
  )
}
