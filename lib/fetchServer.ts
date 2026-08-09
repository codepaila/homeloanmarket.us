import { baseUrl } from '@/utils/baseUrl'

// ==================== USERS ====================
export const getUserDetails = async (id: string) => {
  const res = await fetch(`${baseUrl}/api/users/${id}`, {
    cache: 'no-store'
  })
  if (!res.ok) {
    throw new Error('Failed to fetch user')
  }
  return res.json()
}

export const getCurrentUserDetails = async () => {
  const res = await fetch(`${baseUrl}/api/users/me`, {
    cache: 'no-store'
  })
  if (!res.ok) {
    throw new Error('Failed to fetch current user')
  }
  return res.json()
}

// ==================== BROKERS ====================
export const getBrokerDetails = async (id: string) => {
  const res = await fetch(`${baseUrl}/api/brokers/${id}`, {
    cache: 'no-store'
  })
  if (!res.ok) {
    throw new Error('Failed to fetch broker')
  }
  return res.json()
}

export const getBrokerBySlug = async (slug: string) => {
  const res = await fetch(`${baseUrl}/api/brokers/slug/${slug}`, {
    cache: 'no-store'
  })
  if (!res.ok) {
    throw new Error('Failed to fetch broker')
  }
  return res.json()
}

// ==================== LOAN APPLICATIONS ====================
export const getLoanApplicationDetails = async (id: string) => {
  const res = await fetch(`${baseUrl}/api/loan-applications/${id}`, {
    cache: 'no-store'
  })
  if (!res.ok) {
    throw new Error('Failed to fetch loan application')
  }
  return res.json()
}

export const getLoanApplicationByNumber = async (applicationNumber: string) => {
  const res = await fetch(`${baseUrl}/api/loan-applications/number/${applicationNumber}`, {
    cache: 'no-store'
  })
  if (!res.ok) {
    throw new Error('Failed to fetch loan application')
  }
  return res.json()
}

// ==================== DOCUMENTS ====================
export const getDocumentDetails = async (id: string) => {
  const res = await fetch(`${baseUrl}/api/documents/${id}`, {
    cache: 'no-store'
  })
  if (!res.ok) {
    throw new Error('Failed to fetch document')
  }
  return res.json()
}

export const getApplicationDocuments = async (applicationId: string) => {
  const res = await fetch(`${baseUrl}/api/loan-applications/${applicationId}/documents`, {
    cache: 'no-store'
  })
  if (!res.ok) {
    throw new Error('Failed to fetch documents')
  }
  return res.json()
}

// ==================== REVIEWS ====================
export const getReviewDetails = async (id: string) => {
  const res = await fetch(`${baseUrl}/api/reviews/${id}`, {
    cache: 'no-store'
  })
  if (!res.ok) {
    throw new Error('Failed to fetch review')
  }
  return res.json()
}

// ==================== CALCULATOR ====================
export const calculateEMI = async (data: {
  loanAmount: number
  interestRate: number
  loanTenure: number
  propertyValue: number
  downPayment: number
}) => {
  const res = await fetch(`${baseUrl}/api/calculator/emi`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })
  if (!res.ok) {
    throw new Error('Failed to calculate EMI')
  }
  return res.json()
}

// ==================== PROPERTY DETAILS ====================
export const getPropertyTypes = async () => {
  const res = await fetch(`${baseUrl}/api/property-types`, {
    cache: 'no-store'
  })
  if (!res.ok) {
    throw new Error('Failed to fetch property types')
  }
  return res.json()
}

export const getEmploymentTypes = async () => {
  const res = await fetch(`${baseUrl}/api/employment-types`, {
    cache: 'no-store'
  })
  if (!res.ok) {
    throw new Error('Failed to fetch employment types')
  }
  return res.json()
}

// ==================== BANK & LOAN DETAILS ====================
export const getBankDetails = async (id: string) => {
  const res = await fetch(`${baseUrl}/api/banks/${id}`, {
    cache: 'no-store'
  })
  if (!res.ok) {
    throw new Error('Failed to fetch bank details')
  }
  return res.json()
}

export const getLoanTypeDetails = async (type: string) => {
  const res = await fetch(`${baseUrl}/api/loan-types/${type}`, {
    cache: 'no-store'
  })
  if (!res.ok) {
    throw new Error('Failed to fetch loan type details')
  }
  return res.json()
}

// ==================== LOCATION DETAILS ====================
export const getCityDetails = async (city: string) => {
  const res = await fetch(`${baseUrl}/api/cities/${city}`, {
    cache: 'no-store'
  })
  if (!res.ok) {
    throw new Error('Failed to fetch city details')
  }
  return res.json()
}

export const getStateDetails = async (state: string) => {
  const res = await fetch(`${baseUrl}/api/states/${state}`, {
    cache: 'no-store'
  })
  if (!res.ok) {
    throw new Error('Failed to fetch state details')
  }
  return res.json()
}

// ==================== SUPPORT ====================
export const getSupportTicketDetails = async (ticketNumber: string) => {
  const res = await fetch(`${baseUrl}/api/support/tickets/${ticketNumber}`, {
    cache: 'no-store'
  })
  if (!res.ok) {
    throw new Error('Failed to fetch support ticket')
  }
  return res.json()
}

// ==================== NOTIFICATION ====================
export const getNotificationDetails = async (id: string) => {
  const res = await fetch(`${baseUrl}/api/notifications/${id}`, {
    cache: 'no-store'
  })
  if (!res.ok) {
    throw new Error('Failed to fetch notification')
  }
  return res.json()
}

// ==================== ANALYTICS ====================
export const getBrokerAnalyticsDetails = async (brokerId: string, period: string = 'monthly') => {
  const res = await fetch(`${baseUrl}/api/brokers/${brokerId}/analytics/${period}`, {
    cache: 'no-store'
  })
  if (!res.ok) {
    throw new Error('Failed to fetch analytics')
  }
  return res.json()
}

// ==================== BORROWER ====================
export const getBorrowerDetails = async (id: string) => {
  const res = await fetch(`${baseUrl}/api/borrowers/${id}`, {
    cache: 'no-store'
  })
  if (!res.ok) {
    throw new Error('Failed to fetch borrower')
  }
  return res.json()
}

// ==================== SUBSCRIPTION ====================
export const getSubscriptionDetails = async () => {
  const res = await fetch(`${baseUrl}/api/subscription/details`, {
    cache: 'no-store'
  })
  if (!res.ok) {
    throw new Error('Failed to fetch subscription details')
  }
  return res.json()
}

export const getSubscriptionPlans = async () => {
  const res = await fetch(`${baseUrl}/api/subscription/plans`, {
    cache: 'no-store'
  })
  if (!res.ok) {
    throw new Error('Failed to fetch subscription plans')
  }
  return res.json()
}

// ==================== LEAD ====================
export const getLeadDetails = async (id: string) => {
  const res = await fetch(`${baseUrl}/api/leads/${id}`, {
    cache: 'no-store'
  })
  if (!res.ok) {
    throw new Error('Failed to fetch lead')
  }
  return res.json()
}

// ==================== VERIFICATION ====================
export const getVerificationStatus = async (brokerId: string) => {
  const res = await fetch(`${baseUrl}/api/brokers/${brokerId}/verification-status`, {
    cache: 'no-store'
  })
  if (!res.ok) {
    throw new Error('Failed to fetch verification status')
  }
  return res.json()
}

// ==================== MORTGAGE RATES ====================
export const getCurrentMortgageRates = async (loanType?: string, city?: string) => {
  const queryParams = new URLSearchParams()
  if (loanType) queryParams.append('loanType', loanType)
  if (city) queryParams.append('city', city)

  const res = await fetch(`${baseUrl}/api/mortgage-rates${queryParams.toString() ? '?' + queryParams.toString() : ''}`, {
    cache: 'no-store'
  })
  if (!res.ok) {
    throw new Error('Failed to fetch mortgage rates')
  }
  return res.json()
}