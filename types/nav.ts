import type { LucideIcon } from 'lucide-react'

export type UserRole = 'USER' | 'BROKER' | 'ADMIN'

export type SidebarItem = {
  title: string
  url?: string
  icon?: LucideIcon
  items?: SidebarItem[]
  badge?: string | number
  enabled?: boolean
  roles?: UserRole[]
  requiresSubscription?: boolean
}

export type SidebarSection = {
  label: string
  items: SidebarItem[]
  enabled?: boolean
  roles?: UserRole[]
}

export type QuickAction = {
  title: string
  url: string
  icon: LucideIcon
  color: string
  badge?: string | number
  enabled?: boolean
}

export type SidebarBrokerProfile = {
  id?: string
  displayName?: string
  companyName?: string | null
  verificationStatus?: string
  brokerStatus?: string
  profileSlug?: string
  avgRating?: number
  totalReviews?: number
  totalLeads?: number
  profileViews?: number
  subscription: {
    plan?: string
    isActive?: boolean
    startDate?: Date
    endDate?: Date | null
  } | null
}

export type SidebarUser = {
  id: string
  name: string
  email: string
  phone: string
  image: string
  role: string
  isActive: boolean
  brokerProfile: SidebarBrokerProfile | null
  hasActiveSubscription: boolean
  subscriptionPlan: string
  isVerifiedBroker: boolean
  isFeaturedBroker: boolean
  isPremiumBroker: boolean
  // Legacy aliases accessed by some sidebar variants (always undefined).
  isVerified?: boolean
  isPremium?: boolean
}

export type SidebarData = {
  user: SidebarUser
  navMain: SidebarItem[]
  quickActions: QuickAction[]
}

// The permissions object returned by useUserPermissions(). Kept as a single
// source of truth so sidebar/nav components don't re-declare ad-hoc shapes.
export type UserPermissions = {
  canViewDashboard: boolean
  canBrowseBrokers: boolean
  canContactBrokers: boolean
  canAccessSupport: boolean
  canAccessSettings: boolean
  canManageBrokers: boolean
  canManageUsers: boolean
  canManageSubscriptions: boolean
  canViewAdminPanel: boolean
  canVerifyBrokers: boolean
  canManageFeaturedListings: boolean
  canCreateBrokerProfile: boolean
  canEditProfile: boolean
  canViewBrokerPanel: boolean
  canAccessAnalytics: boolean
  canShowContactDetails: boolean
  canGetVerifiedBadge: boolean
  canCreateFeaturedListing: boolean
  canAccessPremiumSupport: boolean
  canViewAllLeads: boolean
  canUseAdvancedFeatures: boolean
  canExportData: boolean
  canAddMultipleBanks: boolean
  isAdmin: boolean
  isBroker: boolean
  isUser: boolean
  hasActiveSubscription: boolean
  isVerifiedBroker: boolean
  isFeaturedBroker: boolean
}
