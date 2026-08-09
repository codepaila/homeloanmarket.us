// hooks/useCurrentUser.ts
'use client'

import { useSession } from "next-auth/react"
import { UserRole, VerificationStatus, BrokerStatus, SubscriptionPlan } from "@prisma/client"

interface SessionUser {
  id: string;
  name?: string | null;
  email?: string | null;
  emailVerified?: boolean | null;
  phone?: string | null;
  image?: string | null;
  role: UserRole;
  isActive: boolean;
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

export function useUserPermissions() {
  const user = useCurrentUser()

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
      
      // Broker permissions
      canCreateBrokerProfile: false,
      canEditProfile: false,
      canViewBrokerPanel: false,
      canAccessAnalytics: false,
      
      // Feature access
      canUseAdvancedFeatures: false,
      canAccessSupport: true,
      canAccessSettings: false,
    }
  }

  const isAdmin = user.isAdmin
  const isBroker = user.isBroker
  const hasActiveSubscription = user.hasActiveSubscription
  const isFeatured = user.isFeaturedBroker
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
    canViewAllLeads: isBroker && user.isVerifiedBroker,
    
    // Feature flags
    canUseAdvancedFeatures: false,
    canExportData: false,
    canAddMultipleBanks: isBroker && hasActiveSubscription,
    
    // Role checks
    isAdmin,
    isBroker,
    isUser: user.isUser,
    hasActiveSubscription,
    isVerifiedBroker: user.isVerifiedBroker,
    isFeaturedBroker: user.isFeaturedBroker,
  }
}
