// hooks/useCurrentUser.ts
'use client'

import { useSession } from "next-auth/react"
import { UserRole, VerificationStatus, BrokerStatus, SubscriptionPlan } from "@prisma/client"
import type { UserPermissions } from "@/types/nav"

interface SessionUser {
  id: string;
  name?: string | null;
  email?: string | null;
  emailVerified?: boolean | null;
  phone?: string | null;
  image?: string | null;
  role: UserRole;
  isActive: boolean;
  isCompany?: boolean;
  brokerProfile?: {
    id: string;
    displayName: string;
    companyName?: string | null;
    verificationStatus: VerificationStatus;
    brokerStatus: BrokerStatus;
    profileSlug: string;
    subscription?: {
      plan: SubscriptionPlan;
      isActive: boolean;
      startDate: Date;
      endDate?: Date | null;
    } | null;
  } | null;
}

export function useCurrentUser() {
  const { data: session, status } = useSession()

  if (!session?.user) {
    return null
  }

  const user = session.user as SessionUser
  const brokerProfile = user.brokerProfile
  const subscription = brokerProfile?.subscription
  const subscriptionIsActive = Boolean(
    subscription &&
    subscription.isActive &&
    (!subscription.endDate || new Date(subscription.endDate) > new Date()),
  )
  const isFeatured = subscriptionIsActive && subscription?.plan === 'FEATURED'

  // Helper booleans for easy checks
  return {
    ...user,
    emailVerified: user.emailVerified,
    isAdmin: user.role === "ADMIN",
    isBroker: user.role === "BROKER",
    isUser: user.role === "USER",
    isCompany: user.isCompany === true,
  hasActiveSubscription: Boolean(brokerProfile) && (subscription ? subscriptionIsActive : true),
    isVerifiedBroker: brokerProfile?.verificationStatus === "VERIFIED",
    isFeaturedBroker: isFeatured,
    isPremiumBroker: false,
    subscription: subscription,
    brokerProfile: brokerProfile ? {
      ...brokerProfile,
       hasActiveSubscription: Boolean(subscription) && subscriptionIsActive,
       canShowContact: isFeatured,
       isFeatured,
      isVerified: brokerProfile.verificationStatus === "VERIFIED",
    } : null,
  }
}

// Minimal shape required to derive permissions. Both the JWT session user
// (from useCurrentUser) and the database-backed user (from getCurrentUser)
// satisfy this, so the broker layout can pass either source.
type PermissionUserInput = {
  isAdmin?: boolean
  isBroker?: boolean
  isUser?: boolean
  hasActiveSubscription?: boolean
  isFeaturedBroker?: boolean
  isVerifiedBroker?: boolean
  isPremiumBroker?: boolean
  subscription?: { plan?: string } | null
  brokerProfile?: unknown
}

export function useUserPermissions(
  overrideUser?: PermissionUserInput | null,
): UserPermissions {
  const sessionUser = useCurrentUser()
  const user = overrideUser ?? sessionUser

  if (!user) {
    return {
      // Basic permissions
      canViewDashboard: false,
      canBrowseBrokers: true,
      canContactBrokers: false,

      // Admin permissions
      canManageBrokers: false,
      canManageUsers: false,
      canManageSubscriptions: false,
      canViewAdminPanel: false,
      canVerifyBrokers: false,
      canManageFeaturedListings: false,

      // Broker permissions
      canCreateBrokerProfile: false,
      canEditProfile: false,
      canViewBrokerPanel: false,
      canAccessAnalytics: false,

      // Feature access
      canUseAdvancedFeatures: false,
      canAccessSupport: true,
      canAccessSettings: false,

      // Subscription features
      canShowContactDetails: false,
      canGetVerifiedBadge: false,
      canCreateFeaturedListing: false,
      canAccessPremiumSupport: false,
      canViewAllLeads: false,

      // Feature flags
      canExportData: false,
      canAddMultipleBanks: false,

      // Role checks
      isAdmin: false,
      isBroker: false,
      isUser: false,
      hasActiveSubscription: false,
      isVerifiedBroker: false,
      isFeaturedBroker: false,
    }
  }

  const isAdmin = user.isAdmin ?? false
  const isBroker = user.isBroker ?? false
  const hasActiveSubscription = user.hasActiveSubscription ?? false
  const isFeatured = user.isFeaturedBroker ?? false
  const isVerifiedBroker = user.isVerifiedBroker ?? false
  const subscriptionPlan = user.subscription?.plan || "FREE"

  return {
    // Basic permissions (all users)
    canViewDashboard: true,
    canBrowseBrokers: true,
    canContactBrokers: true,
    canAccessSupport: true,
    canAccessSettings: true,

    // Admin permissions
    canManageBrokers: isAdmin,
    canManageUsers: isAdmin,
    canManageSubscriptions: isAdmin,
    canViewAdminPanel: isAdmin,
    canVerifyBrokers: isAdmin,
    canManageFeaturedListings: isAdmin,

    // Broker permissions
    canCreateBrokerProfile: !user.brokerProfile, // Can create if doesn't have profile
    canEditProfile: isBroker,
    canViewBrokerPanel: isBroker,
    canAccessAnalytics: false,

    // Subscription features
    canShowContactDetails: isBroker && isFeatured,
      canGetVerifiedBadge: false,
      canCreateFeaturedListing: isBroker && subscriptionPlan === "FEATURED",
      canAccessPremiumSupport: false,
    canViewAllLeads: isBroker && isVerifiedBroker,

    // Feature flags
    canUseAdvancedFeatures: false,
    canExportData: false,
    canAddMultipleBanks: isBroker && hasActiveSubscription,

    // Role checks
    isAdmin,
    isBroker,
    isUser: user.isUser ?? false,
    hasActiveSubscription,
    isVerifiedBroker: isVerifiedBroker,
    isFeaturedBroker: isFeatured,
  }
}
