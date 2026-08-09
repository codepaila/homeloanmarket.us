// hooks/useSidebarData.js
import { appSidebarData } from '@/components/layout/admin/sideBarData'
import { useCurrentUser } from '@/hooks/useCurrentUser'

export function useSidebarData() {
  const user = useCurrentUser()
  const sidebarData = appSidebarData(user)
  
  return {
    ...sidebarData,
    // Additional computed properties
    // hasUnreadNotifications: sidebarData.user?.unreadNotifications > 0,
    hasUnreadNotifications: false,
    canAccessAdmin: user?.isAdmin ,
    canAccessBroker: user?.isBroker,
    canAccessBorrower: user?.isUser,
    // Role-based visibility helpers
    showBrokerFeatures: user?.isBroker && user?.hasActiveSubscription,
    showPremiumFeatures: user?.isPremiumBroker,
  }
}