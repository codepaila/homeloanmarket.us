'use client'

import useSWR from 'swr'
import { baseUrl } from '@/utils/baseUrl'

const fetcher = async (url: string) => {
  const res = await fetch(url)
  const data = await res.json()
  if (!res.ok) {
    const error = new Error(data.message)
    throw error
  }
  return data
}

// ==================== USERS ====================
export const fetchAllUsers = (page: number = 1, pageSize: number = 10, search?: string, role?: string) => {
  const queryParams = new URLSearchParams()
  queryParams.append('page', page.toString())
  queryParams.append('pageSize', pageSize.toString())
  if (search) queryParams.append('search', search)
  if (role) queryParams.append('role', role)

  const { data, error, mutate, isLoading } = useSWR(
    `${baseUrl}/api/users?${queryParams.toString()}`,
    fetcher
  )
  
  const { users, total, totalPages } = data || {}
  return { users, total, totalPages, error, mutate, isLoading }
}

export const fetchUser = (id: string) => {
  const { data, error, mutate, isLoading } = useSWR(
    id ? `${baseUrl}/api/users/${id}` : null,
    fetcher
  )
  return { data, error, mutate, isLoading }
}

// ==================== BROKERS ====================
export const fetchAllBrokers = (
  page: number = 1,
  minRating?: number,
  verificationStatus?: string,
  featured?: boolean,
  search?: string
) => {
  const queryParams = new URLSearchParams()
  queryParams.append('page', page.toString())
  if (minRating) queryParams.append('minRating', minRating.toString())
  if (verificationStatus) queryParams.append('verificationStatus', verificationStatus)
  if (featured !== undefined) queryParams.append('featured', featured.toString())
  if (search) queryParams.append('search', search)

  const { data, error, mutate, isLoading } = useSWR(
    `${baseUrl}/api/brokers?${queryParams.toString()}`,
    fetcher
  )
  
  const { brokers, total, totalPages } = data || {}
  return { brokers, total, totalPages, error, mutate, isLoading }
}

export const fetchFeaturedBrokers = () => {
  const { data, error, mutate, isLoading } = useSWR(
    `${baseUrl}/api/brokers/featured`,
    fetcher
  )
  
  const brokers = data?.brokers || []
  return { brokers, error, mutate, isLoading }
}

export const fetchBroker = (id: string) => {
  const { data, error, mutate, isLoading } = useSWR(
    id ? `${baseUrl}/api/brokers/${id}` : null,
    fetcher
  )
    const broker = data?.broker
  return { broker, error, mutate, isLoading }
}

export const fetchMyBrokerProfile = () => {
  const { data, error, mutate, isLoading } = useSWR(
    `${baseUrl}/api/brokers/me`,
    fetcher
  )
  return { data, error, mutate, isLoading }
}

// ==================== LOAN APPLICATIONS ====================
export const fetchLoanApplications = (
  page: number = 1,
  status?: string,
  loanType?: string,
  propertyType?: string,
  propertyCity?: string,
  minAmount?: number,
  maxAmount?: number,
  startDate?: string,
  endDate?: string
) => {
  const queryParams = new URLSearchParams()
  queryParams.append('page', page.toString())
  if (status) queryParams.append('status', status)
  if (loanType) queryParams.append('loanType', loanType)
  if (propertyType) queryParams.append('propertyType', propertyType)
  if (propertyCity) queryParams.append('propertyCity', propertyCity)
  if (minAmount) queryParams.append('minAmount', minAmount.toString())
  if (maxAmount) queryParams.append('maxAmount', maxAmount.toString())
  if (startDate) queryParams.append('startDate', startDate)
  if (endDate) queryParams.append('endDate', endDate)

  const { data, isLoading, error, mutate } = useSWR(
    `${baseUrl}/api/loan-applications?${queryParams.toString()}`,
    fetcher
  )
  
  const { applications, total, totalPages } = data || {}
  return { applications, total, totalPages, isLoading, error, mutate }
}

export const fetchMyLoanApplications = (page: number = 1, status?: string) => {
  const queryParams = new URLSearchParams()
  queryParams.append('page', page.toString())
  if (status) queryParams.append('status', status)

  const { data, isLoading, error, mutate } = useSWR(
    `${baseUrl}/api/loan-applications/my?${queryParams.toString()}`,
    fetcher
  )
  
  const { applications, total, totalPages } = data || {}
  return { applications, total, totalPages, isLoading, error, mutate }
}

export const fetchLoanApplication = (id: string) => {
  const { data, error, mutate, isLoading } = useSWR(
    id ? `${baseUrl}/api/loan-applications/${id}` : null,
    fetcher
  )
  return { data, error, mutate, isLoading }
}

// ==================== REVIEWS ====================
export const fetchBrokerReviews = (brokerId: string, page: number = 1) => {
  const { data, error, mutate, isLoading } = useSWR(
    brokerId ? `${baseUrl}/api/brokers/${brokerId}/reviews?page=${page}` : null,
    fetcher
  )
  
  const { reviews, total, avgRating } = data || {}
  return { reviews, total, avgRating, error, mutate, isLoading }
}

export const fetchMyReviews = () => {
  const { data, error, mutate, isLoading } = useSWR(
    `${baseUrl}/api/reviews/my`,
    fetcher
  )
  return { data, error, mutate, isLoading }
}


// ==================== BROKER COMMUNICATIONS ====================
export const fetchBrokerContacts = (
  brokerId: string,
  page: number = 1,
  status?: string,
  search?: string
) => {
  const queryParams = new URLSearchParams()
  queryParams.append('page', page.toString())
  if (status) queryParams.append('status', status)
  if (search) queryParams.append('search', search)

  const { data, error, mutate, isLoading } = useSWR(
    `${baseUrl}/api/brokers/${brokerId}/contacts?${queryParams.toString()}`,
    fetcher
  )
  
  const { contacts, total, totalPages } = data || {}
  const leads = contacts

  return { leads, total, totalPages, error, mutate, isLoading }
}

export const fetchBrokerCommunications = (
  brokerId: string,
  page: number = 1,
  type?: string,
  read?: boolean
) => {
  const queryParams = new URLSearchParams()
  queryParams.append('page', page.toString())
  if (type) queryParams.append('type', type)
  if (read !== undefined) queryParams.append('read', read.toString())

  const { data, error, mutate, isLoading } = useSWR(
    `${baseUrl}/api/brokers/${brokerId}/communications?${queryParams.toString()}`,
    fetcher
  )
  
  const { communications, total, unreadCount } = data || {}
  return { communications, total, unreadCount, error, mutate, isLoading }
}

// ==================== SEND MESSAGE ====================
export const sendMessage = async (brokerId: string, messageData: any) => {
  try {
    const response = await fetch(`${baseUrl}/api/brokers/${brokerId}/communications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messageData),
    })

    const result = await response.json()
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to send message')
    }

    return result
  } catch (error) {
    console.error('Error sending message:', error)
    throw error
  }
}
// ==================== LEADS ====================
export const fetchLeads = (brokerId?: string, status?: string, page: number = 1) => {
  const queryParams = new URLSearchParams()
  queryParams.append('page', page.toString())
  if (status) queryParams.append('status', status)

  const url = brokerId 
    ? `${baseUrl}/api/brokers/${brokerId}/leads?${queryParams.toString()}`
    : `${baseUrl}/api/leads?${queryParams.toString()}`

  const { data, error, mutate, isLoading } = useSWR(url, fetcher)
  
  const { leads, total, totalPages } = data || {}
  return { leads, total, totalPages, error, mutate, isLoading }
}

export const fetchMyLeads = (page: number = 1, status?: string) => {
  const queryParams = new URLSearchParams()
  queryParams.append('page', page.toString())
  if (status) queryParams.append('status', status)

  const { data, error, mutate, isLoading } = useSWR(
    `${baseUrl}/api/leads/my?${queryParams.toString()}`,
    fetcher
  )
  
  const { leads, total, totalPages } = data || {}
  return { leads, total, totalPages, error, mutate, isLoading }
}

// ==================== CALCULATOR & RATE ALERTS ====================
export const fetchCalculatorHistory = (page: number = 1) => {
  const { data, error, mutate, isLoading } = useSWR(
    `${baseUrl}/api/calculator/history?page=${page}`,
    fetcher
  )
  
  const { history, total, totalPages } = data || {}
  return { history, total, totalPages, error, mutate, isLoading }
}

export const fetchRateAlerts = () => {
  const { data, error, mutate, isLoading } = useSWR(
    `${baseUrl}/api/rate-alerts`,
    fetcher
  )
  return { data, error, mutate, isLoading }
}

// ==================== SAVED BROKERS ====================
export const fetchSavedBrokers = () => {
  const { data, error, mutate, isLoading } = useSWR(
    `${baseUrl}/api/saved-brokers`,
    fetcher
  )
  
  const brokers = data?.brokers || []
  return { brokers, error, mutate, isLoading }
}

// ==================== DASHBOARD & ANALYTICS ====================
export const fetchDashboardStats = (timeRange: string = '30days') => {
  const { data, error, mutate, isLoading } = useSWR(
    `${baseUrl}/api/dashboard/stats?range=${timeRange}`,
    fetcher
  )
  return { data, error, mutate, isLoading }
}

export const fetchBrokerAnalytics = (brokerId?: string, startDate?: string, endDate?: string) => {
  const queryParams = new URLSearchParams()
  if (startDate) queryParams.append('startDate', startDate)
  if (endDate) queryParams.append('endDate', endDate)

  const url = brokerId 
    ? `${baseUrl}/api/brokers/${brokerId}/analytics${queryParams.toString() ? '?' + queryParams.toString() : ''}`
    : `${baseUrl}/api/brokers/me/analytics${queryParams.toString() ? '?' + queryParams.toString() : ''}`

  const { data, error, mutate, isLoading } = useSWR(url, fetcher)
  return { data, error, mutate, isLoading }
}

// ==================== BANK RELATIONS & LOAN PRODUCTS ====================
export const fetchBrokerBankRelations = (brokerId?: string) => {
  const url = brokerId 
    ? `${baseUrl}/api/brokers/${brokerId}/bank-relations`
    : `${baseUrl}/api/brokers/me/bank-relations`

  const { data, error, mutate, isLoading } = useSWR(url, fetcher)
  
  const { bankRelations } = data || {}
  return { bankRelations, error, mutate, isLoading }
}

export const fetchBrokerLoanProducts = (brokerId?: string) => {
  const url = brokerId 
    ? `${baseUrl}/api/brokers/${brokerId}/loan-products`
    : `${baseUrl}/api/brokers/me/loan-products`

  const { data, error, mutate, isLoading } = useSWR(url, fetcher)
  
  const { loanProducts } = data || {}
  return { loanProducts, error, mutate, isLoading }
}



// ==================== NOTIFICATIONS & SUPPORT ====================
export const fetchNotifications = (page: number = 1, read?: boolean) => {
  const queryParams = new URLSearchParams()
  queryParams.append('page', page.toString())
  if (read !== undefined) queryParams.append('read', read.toString())

  const { data, error, mutate, isLoading } = useSWR(
    `${baseUrl}/api/notifications?${queryParams.toString()}`,
    fetcher
  )
  
  const { notifications, total, totalPages } = data || {}
  return { notifications, total, totalPages, error, mutate, isLoading }
}

export const fetchSupportTickets = (page: number = 1, status?: string) => {
  const queryParams = new URLSearchParams()
  queryParams.append('page', page.toString())
  if (status) queryParams.append('status', status)

  const { data, error, mutate, isLoading } = useSWR(
    `${baseUrl}/api/support/tickets?${queryParams.toString()}`,
    fetcher
  )
  
  const { tickets, total, totalPages } = data || {}
  return { tickets, total, totalPages, error, mutate, isLoading }
}

// ==================== MESSAGES ====================
export const fetchMessages = (conversationId?: string, page: number = 1) => {
  const queryParams = new URLSearchParams()
  queryParams.append('page', page.toString())
  
  const url = conversationId
    ? `${baseUrl}/api/messages/${conversationId}?${queryParams.toString()}`
    : `${baseUrl}/api/messages?${queryParams.toString()}`

  const { data, error, mutate, isLoading } = useSWR(url, fetcher)
  
  const { messages, total, totalPages } = data || {}
  return { messages, total, totalPages, error, mutate, isLoading }
}



// ==================== CITIES API ====================
export const fetchCities = async (state?: string): Promise<string[]> => {
  try {
    const queryParams = new URLSearchParams()
    if (state) queryParams.append('state', state)

    const res = await fetch(
      `${baseUrl}/api/cities${queryParams.toString() ? '?' + queryParams.toString() : ''}`
    )
    
    if (!res.ok) {
      throw new Error('Failed to fetch cities')
    }
    
    const data = await res.json()
    return data.cities || []
  } catch (error) {
    console.error('Error fetching cities:', error)
    return []
  }
}

// SWR version for client components
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

// ==================== US STATES API ====================
export const fetchUSStates = async (): Promise<Array<{ code: string; name: string }>> => {
  try {
    const res = await fetch(`${baseUrl}/api/states`)
    if (!res.ok) {
      throw new Error('Failed to fetch states')
    }
    const data = await res.json()
    return data.states || []
  } catch (error) {
    console.error('Error fetching states:', error)
    return []
  }
}

export const useUSStates = () => {
  const { data, error, mutate, isLoading } = useSWR(
    `${baseUrl}/api/states`,
    fetcher
  )
  const states = data?.states || []
  return { states, error, mutate, isLoading }
}

// ==================== PROPERTY TYPES ====================
export const fetchPropertyTypes = async (): Promise<string[]> => {
  try {
    const res = await fetch(`${baseUrl}/api/property-types`)
    
    if (!res.ok) {
      throw new Error('Failed to fetch property types')
    }
    
    const data = await res.json()
    return data.propertyTypes || []
  } catch (error) {
    console.error('Error fetching property types:', error)
    return ['Residential', 'Commercial', 'Plot', 'Agricultural', 'Industrial']
  }
}

export const usePropertyTypes = () => {
  const { data, error, mutate, isLoading } = useSWR(
    `${baseUrl}/api/property-types`,
    fetcher
  )
  
  const propertyTypes = data?.propertyTypes || []
  return { propertyTypes, error, mutate, isLoading }
}

// Other fetch functions remain the same...
// export const fetchCities = (state?: string) => {
//   const queryParams = new URLSearchParams()
//   if (state) queryParams.append('state', state)

//   const { data, error, mutate, isLoading } = useSWR(
//     `${baseUrl}/api/cities${queryParams.toString() ? '?' + queryParams.toString() : ''}`,
//     fetcher
//   )
  
//   const cities = data?.cities || []
//   return { cities, error, mutate, isLoading }
// }

export const fetchStates = () => {
  const { data, error, mutate, isLoading } = useSWR(
    `${baseUrl}/api/states`,
    fetcher
  )
  
  const states = data?.states || []
  return { states, error, mutate, isLoading }
}

// ==================== BANK & LOAN TYPES ====================
export const fetchBanks = () => {
  const { data, error, mutate, isLoading } = useSWR(
    `${baseUrl}/api/banks`,
    fetcher
  )
  
  const banks = data?.banks || []
  return { banks, error, mutate, isLoading }
}

export const fetchLoanTypes = () => {
  const { data, error, mutate, isLoading } = useSWR(
    `${baseUrl}/api/loan-types`,
    fetcher
  )
  
  const loanTypes = data?.loanTypes || []
  return { loanTypes, error, mutate, isLoading }
}

// ==================== QUICK STATS ====================
export const fetchQuickStats = () => {
  const { data, error, mutate, isLoading } = useSWR(
    `${baseUrl}/api/stats/quick`,
    fetcher
  )
  return { data, error, mutate, isLoading }
}