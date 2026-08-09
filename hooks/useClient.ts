/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import useSWR from 'swr'
import { baseUrl } from '@/utils/baseUrl'

const fetcher = async (url: string) => {
  const res = await fetch(url)
  const data = await res.json()
  if (!res.ok) {
    const error = new Error(data.message || 'Failed to fetch data')
    throw error
  }
  return data
}

// ==================== BROKERS ====================
export const useAllBrokers = (
  page: number = 1,
  pageSize: number = 12,
  city?: string,
  specialization?: string,
  minRating?: number,
  verificationStatus?: string,
  featured?: boolean,
  search?: string,
  brokerStatus?: string,
  minExperience?: number,
  language?: string,
  zip?: string
) => {
  const queryParams = new URLSearchParams()
  queryParams.append('page', page.toString())
  queryParams.append('pageSize', pageSize.toString())
  if (city) queryParams.append('city', city)
  if (zip) queryParams.append('zip', zip)
  if (specialization) queryParams.append('specialization', specialization)
  if (minRating) queryParams.append('minRating', minRating.toString())
  if (verificationStatus) queryParams.append('verificationStatus', verificationStatus)
  if (featured !== undefined) queryParams.append('featured', featured.toString())
  if (search) queryParams.append('search', search)
  if (brokerStatus) queryParams.append('brokerStatus', brokerStatus)
  if (minExperience) queryParams.append('minExperience', minExperience.toString())
  if (language) queryParams.append('language', language)

  const { data, error, mutate, isLoading } = useSWR(
    `${baseUrl}/api/brokers?${queryParams.toString()}`,
    fetcher
  )
  
  const { brokers, total, totalPages } = data || {}
  return { brokers, total, totalPages, error, mutate, isLoading }
}

export const useFeaturedBrokers = () => {
  const { data, error, mutate, isLoading } = useSWR(
    `${baseUrl}/api/brokers/featured`,
    fetcher
  )
  
  const brokers = data?.brokers || []
  return { brokers, error, mutate, isLoading }
}

export const useBroker = (slug: string) => {
  const { data, error, mutate, isLoading } = useSWR(
    slug ? `${baseUrl}/api/company/${slug}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // 1 minute
    }
  )
  
  return { 
    broker: data, 
    error, 
    mutate, 
    isLoading 
  }
}

export const useBrokerReviews = (slug: string, page: number = 1, limit: number = 10) => {
  const { data, error, mutate, isLoading } = useSWR(
    slug ? `${baseUrl}/api/company/${slug}/reviews?page=${page}&limit=${limit}` : null,
    fetcher
  )
  
  return {
    reviews: data?.reviews || [],
    total: data?.total || 0,
    avgRating: data?.avgRating || 0,
    error,
    mutate,
    isLoading
  }
}

// For admin access by ID
export const useBrokerById = (id: string) => {
  const { data, error, mutate, isLoading } = useSWR(
    id ? `${baseUrl}/api/brokers/${id}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  )
  
  return { 
    broker: data, 
    error, 
    mutate, 
    isLoading 
  }
}
export const useMyBrokerProfile = () => {
  const { data, error, mutate, isLoading } = useSWR(
    `${baseUrl}/api/brokers/me`,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  )
  return { data: data?.broker, error, mutate, isLoading }
}

// ==================== CONTACT MESSAGES (Replacing Leads) ====================
export const useContactMessages = (brokerId?: string, filters?: {
  status?: 'all' | 'unread' | 'read' | 'responded'
  contactType?: 'all' | 'email' | 'phone' | 'whatsapp' | 'sms'
  search?: string
  page?: number
  pageSize?: number
}) => {
  const queryParams = new URLSearchParams()
  queryParams.append('page', filters?.page?.toString() || '1')
  queryParams.append('pageSize', filters?.pageSize?.toString() || '10')
  if (filters?.status && filters.status !== 'all') queryParams.append('status', filters.status)
  if (filters?.contactType && filters.contactType !== 'all') queryParams.append('contactType', filters.contactType)
  if (filters?.search) queryParams.append('search', filters.search)

  const url = brokerId 
    ? `${baseUrl}/api/brokers/${brokerId}/contacts?${queryParams.toString()}`
    : `${baseUrl}/api/contacts?${queryParams.toString()}`

  const { data, error, mutate, isLoading } = useSWR(url, fetcher)
  
  const { contacts, stats, total, totalPages } = data || {}
  return { contacts, stats, total, totalPages, error, mutate, isLoading }
}

export const useMyContactMessages = (filters?: {
  status?: 'all' | 'unread' | 'read' | 'responded'
  contactType?: 'all' | 'email' | 'phone' | 'whatsapp' | 'sms'
  search?: string
  page?: number
  pageSize?: number
}) => {
  const queryParams = new URLSearchParams()
  queryParams.append('page', filters?.page?.toString() || '1')
  queryParams.append('pageSize', filters?.pageSize?.toString() || '10')
  if (filters?.status && filters.status !== 'all') queryParams.append('status', filters.status)
  if (filters?.contactType && filters.contactType !== 'all') queryParams.append('contactType', filters.contactType)
  if (filters?.search) queryParams.append('search', filters.search)

  const { data, error, mutate, isLoading } = useSWR(
    `${baseUrl}/api/contacts/my?${queryParams.toString()}`,
    fetcher
  )
  
  const { contacts, stats, total, totalPages } = data || {}
  return { contacts, stats, total, totalPages, error, mutate, isLoading }
}

// ==================== REVIEWS ====================

export const useMyReviews = () => {
  const { data, error, mutate, isLoading } = useSWR(
    `${baseUrl}/api/reviews/my`,
    fetcher
  )
  return { data, error, mutate, isLoading }
}

// ==================== SUBSCRIPTIONS ====================
// export const useMySubscription = () => {
//   const { data, error, mutate, isLoading } = useSWR(
//     `${baseUrl}/api/subscriptions/me`,
//     fetcher
//   )
//   return { subscription: data?.subscription, error, mutate, isLoading }
// }
export const useMySubscription = () => {
  const { data, error, mutate, isLoading } = useSWR(
    `${baseUrl}/api/subscription/details`,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  )
  return { subscription: data?.data, error, mutate, isLoading }
}

export const useSubscriptionPlans = () => {
  const { data, error, mutate, isLoading } = useSWR(
    `${baseUrl}/api/subscriptions/plans`,
    fetcher
  )
  return { plans: data?.plans, error, mutate, isLoading }
}

// ==================== NOTIFICATIONS ====================
export const useNotifications = (filters?: {
  read?: boolean
  page?: number
  pageSize?: number
}) => {
  const queryParams = new URLSearchParams()
  queryParams.append('page', filters?.page?.toString() || '1')
  queryParams.append('pageSize', filters?.pageSize?.toString() || '10')
  if (filters?.read !== undefined) queryParams.append('read', filters.read.toString())

  const { data, error, mutate, isLoading } = useSWR(
    `${baseUrl}/api/notifications?${queryParams.toString()}`,
    fetcher
  )
  
  const { notifications, total, totalPages } = data || {}
  return { notifications, total, totalPages, error, mutate, isLoading }
}

// ==================== SUPPORT TICKETS ====================
export const useSupportTickets = (filters?: {
  status?: string
  page?: number
  pageSize?: number
}) => {
  const queryParams = new URLSearchParams()
  queryParams.append('page', filters?.page?.toString() || '1')
  queryParams.append('pageSize', filters?.pageSize?.toString() || '10')
  if (filters?.status) queryParams.append('status', filters.status)

  const { data, error, mutate, isLoading } = useSWR(
    `${baseUrl}/api/support/tickets?${queryParams.toString()}`,
    fetcher
  )
  
  const { tickets, total, totalPages } = data || {}
  return { tickets, total, totalPages, error, mutate, isLoading }
}

// ==================== DASHBOARD STATS ====================
export const useDashboardStats = (timeRange: string = '30days') => {
  const { data, error, mutate, isLoading } = useSWR(
    `${baseUrl}/api/dashboard/stats?range=${timeRange}`,
    fetcher
  )
  return { stats: data, error, mutate, isLoading }
}

export const useBrokerDashboardStats = (brokerId?: string) => {
  const url = brokerId 
    ? `${baseUrl}/api/brokers/${brokerId}/dashboard-stats`
    : `${baseUrl}/api/brokers/me/dashboard-stats`

  const { data, error, mutate, isLoading } = useSWR(url, fetcher)
  return { stats: data, error, mutate, isLoading }
}


// ==================== LOCATION DATA ====================
export const useCities = (state?: string) => {
  const queryParams = new URLSearchParams()
  if (state) queryParams.append('state', state)

  const { data, error, mutate, isLoading } = useSWR(
    `${baseUrl}/api/cities${queryParams.toString() ? '?' + queryParams.toString() : ''}`,
    fetcher
  )
  
  const cities = data?.cities || []
  return { cities, error, mutate, isLoading }
}

export const useStates = () => {
  const { data, error, mutate, isLoading } = useSWR(
    `${baseUrl}/api/states`,
    fetcher
  )
  
  const states = data?.states || []
  return { states, error, mutate, isLoading }
}

// ==================== MESSAGES ====================
export const useMessages = (conversationId?: string, filters?: {
  page?: number
  pageSize?: number
}) => {
  const queryParams = new URLSearchParams()
  queryParams.append('page', filters?.page?.toString() || '1')
  queryParams.append('pageSize', filters?.pageSize?.toString() || '20')

  const url = conversationId
    ? `${baseUrl}/api/messages/${conversationId}?${queryParams.toString()}`
    : `${baseUrl}/api/messages?${queryParams.toString()}`

  const { data, error, mutate, isLoading } = useSWR(url, fetcher)
  
  const { messages, total, totalPages } = data || {}
  return { messages, total, totalPages, error, mutate, isLoading }
}

// ==================== BROKER ANALYTICS ====================
// export const useBrokerAnalytics = (brokerId?: string, period?: string) => {
//   const queryParams = new URLSearchParams()
//   if (period) queryParams.append('period', period)

//   const url = brokerId 
//     ? `${baseUrl}/api/brokers/${brokerId}/analytics${queryParams.toString() ? '?' + queryParams.toString() : ''}`
//     : `${baseUrl}/api/brokers/me/analytics${queryParams.toString() ? '?' + queryParams.toString() : ''}`

//   const { data, error, mutate, isLoading } = useSWR(url, fetcher)
//   return { analytics: data, error, mutate, isLoading }
// }
export const useBrokerAnalytics = (brokerId?: string, period?: string) => {
  const queryParams = new URLSearchParams()
  if (period) queryParams.append('period', period)

  const url = brokerId 
    ? `${baseUrl}/api/brokers/${brokerId}/analytics${queryParams.toString() ? '?' + queryParams.toString() : ''}`
    : `${baseUrl}/api/brokers/me/analytics${queryParams.toString() ? '?' + queryParams.toString() : ''}`

  const { data, error, mutate, isLoading } = useSWR(
    url,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 300000, // 5 minutes
    }
  )

  return { 
    analytics: data, 
    error, 
    mutate, 
    isLoading 
  }
}
// ==================== CONTACT MESSAGE ACTIONS ====================
export const useContactMessageActions = () => {
  const markAsRead = async (messageId: string) => {
    try {
      const response = await fetch(`${baseUrl}/api/contacts/${messageId}/read`, {
        method: 'POST',
      })
      return response.json()
    } catch (error) {
      throw error
    }
  }

  const markAsResponded = async (messageId: string, notes?: string) => {
    try {
      const response = await fetch(`${baseUrl}/api/contacts/${messageId}/responded`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes }),
      })
      return response.json()
    } catch (error) {
      throw error
    }
  }

  const sendContactMessage = async (brokerId: string, data: any) => {
    try {
      const response = await fetch(`${baseUrl}/api/contact/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ brokerId, ...data }),
      })
      return response.json()
    } catch (error) {
      throw error
    }
  }

  return {
    markAsRead,
    markAsResponded,
    sendContactMessage,
  }
}

// ==================== USER PROFILE ====================
export const useUserProfile = () => {
  const { data, error, mutate, isLoading } = useSWR(
    `${baseUrl}/api/users/me`,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  )
  return { user: data, error, mutate, isLoading }
}

// ==================== SAVED BROKERS ====================
export const useSavedBrokers = () => {
  const { data, error, mutate, isLoading } = useSWR(
    `${baseUrl}/api/saved-brokers`,
    fetcher
  )
  
  const brokers = data?.brokers || []
  return { brokers, error, mutate, isLoading }
}

// ==================== CALCULATOR ====================
export const useEMICalculator = () => {
  const calculateEMI = async (data: {
    loanAmount: number
    interestRate: number
    tenureYears: number
    propertyValue?: number
    downPayment?: number
  }) => {
    try {
      const response = await fetch(`${baseUrl}/api/calculator/emi`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })
      return response.json()
    } catch (error) {
      throw error
    }
  }

  return { calculateEMI }
}


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
