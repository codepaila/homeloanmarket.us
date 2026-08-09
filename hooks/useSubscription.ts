'use client'

import useSWR from 'swr'
import { baseUrl } from '@/utils/baseUrl'
import { SubscriptionPlan } from '@prisma/client'

const fetcher = async (url: string) => {
  const res = await fetch(url)
  const data = await res.json()
  if (!res.ok) {
    const error = new Error(data.message || 'Failed to fetch data')
    throw error
  }
  return data
}

// Main subscription hook
export const useSubscription = () => {
  const { data, error, mutate, isLoading } = useSWR(
    `${baseUrl}/api/subscription/details`,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  )

  return {
    subscription: data?.data,
    error,
    mutate,
    isLoading
  }
}

// Usage statistics
export const useSubscriptionUsage = () => {
  const { data, error, mutate, isLoading } = useSWR(
    `${baseUrl}/api/subscription/usage`,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  )

  return {
    usage: data?.data,
    error,
    mutate,
    isLoading
  }
}

// Billing history
export const useBillingHistory = () => {
  const { data, error, mutate, isLoading } = useSWR(
    `${baseUrl}/api/subscription/invoices`,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  )

  return {
    billing: data?.data,
    error,
    mutate,
    isLoading
  }
}

// Subscription actions
export const useSubscriptionActions = () => {
  const handleCheckout = async (priceId: string, plan: SubscriptionPlan) => {
    try {
      const response = await fetch(`${baseUrl}/api/subscription/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ priceId, plan }),
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout')
      }

      return data
    } catch (error) {
      throw error
    }
  }

  const handlePortal = async () => {
    try {
      const response = await fetch(`${baseUrl}/api/subscription/portal`, {
        method: 'POST',
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to access billing portal')
      }

      return data
    } catch (error) {
      throw error
    }
  }

  const handleUpgrade = async (priceId: string, plan: SubscriptionPlan) => {
    try {
      const response = await fetch(`${baseUrl}/api/subscription/upgrade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ priceId, plan }),
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to upgrade subscription')
      }

      return data
    } catch (error) {
      throw error
    }
  }

  const handleCancel = async () => {
    try {
      const response = await fetch(`${baseUrl}/api/subscription/cancel`, {
        method: 'POST',
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel subscription')
      }

      return data
    } catch (error) {
      throw error
    }
  }

  const syncStripeData = async () => {
    try {
      const response = await fetch(`${baseUrl}/api/subscription/sync`, {
        method: 'POST',
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync with Stripe')
      }

      return data
    } catch (error) {
      throw error
    }
  }

  return {
    handleCheckout,
    handlePortal,
    handleUpgrade,
    handleCancel,
    syncStripeData
  }
}

// Subscription plan utilities
export const useSubscriptionPlans = () => {
  const { data, error, mutate, isLoading } = useSWR(
    `${baseUrl}/api/subscription/plans`,
    fetcher
  )

  return {
    plans: data?.plans,
    error,
    mutate,
    isLoading
  }
}

// Subscription status checker
export const useSubscriptionStatus = () => {
  const { subscription, isLoading } = useSubscription()

  const isActive = subscription?.isActive || false
  const plan = subscription?.plan || 'FREE'
  const hasExpired = subscription?.endDate && new Date(subscription.endDate) < new Date()
  const isTrial = false // Add trial logic if needed
  const canUpgrade = plan !== 'FEATURED'
  const canDowngrade = plan !== 'FREE'

  return {
    isActive,
    plan,
    hasExpired,
    isTrial,
    canUpgrade,
    canDowngrade,
    isLoading
  }
}

// Feature access checker
export const useFeatureAccess = () => {
  const { usage } = useSubscriptionUsage()
  const { plan, isActive } = useSubscriptionStatus()

  const canAccess = (feature: string): boolean => {
    if (!isActive) return false

    switch (feature) {
      case 'featured_listing':
        return plan === 'FEATURED'
      case 'show_contact':
        return plan !== 'FREE'
      case 'priority_support':
        return false
      case 'advanced_analytics':
        return plan !== 'FREE'
      case 'custom_profile':
        return false
      case 'multiple_banks':
        return plan !== 'FREE'
      case 'phone_support':
        return false
      default:
        return false
    }
  }

  const hasRemaining = (resource: string, required: number = 1): boolean => {
    if (!usage?.limits || !usage?.usage) return false

    switch (resource) {
      case 'bank_partners':
        return (usage.usage.bankPartners || 0) + required <= (usage.limits.maxBankPartners || 3)
      case 'team_members':
        return (usage.usage.teamMembers || 0) + required <= 10 // Default limit
      default:
        return true
    }
  }

  return {
    canAccess,
    hasRemaining,
    usage,
    plan
  }
}
