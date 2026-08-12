export type AdminBrokerInput = {
  displayName: string
  companyName?: string
  nmls?: string
  description: string
  phone: string
  email?: string
  website?: string
  officeAddress: string
  city: string
  state: string
  pinCode: string
  experienceYears?: number | string
  specializations?: string[]
  serviceCities?: string[]
  languages?: string[]
  registrationNumber?: string
  panNumber?: string
  logo?: string
  coverImage?: string
}

export function normalizeAdminBrokerInput(input: AdminBrokerInput) {
  return {
    displayName: input.displayName.trim(),
    companyName: input.companyName?.trim() || null,
    nmls: input.nmls?.trim() || null,
    description: input.description.trim(),
    phone: input.phone.trim(),
    email: input.email?.trim().toLowerCase() || null,
    website: input.website?.trim() || null,
    officeAddress: input.officeAddress.trim(),
    city: input.city.trim(),
    state: input.state.trim(),
    pinCode: input.pinCode.trim(),
    experienceYears: Number(input.experienceYears || 0),
    specializations: (input.specializations || []).map((item) => item.trim()).filter(Boolean),
    serviceCities: (input.serviceCities || []).map((item) => item.trim()).filter(Boolean),
    languages: (input.languages || ['English']).map((item) => item.trim()).filter(Boolean),
    registrationNumber: input.registrationNumber?.trim() || null,
    panNumber: input.panNumber?.trim() || null,
    logo: input.logo?.trim() || null,
    coverImage: input.coverImage?.trim() || null,
  }
}

export function validateAdminBrokerInput(input: ReturnType<typeof normalizeAdminBrokerInput>) {
  const errors: string[] = []
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const phoneDigits = input.phone.replace(/\D/g, '')

  if (!input.displayName || input.displayName.length < 2) errors.push('Display name is required')
  if (!input.description) errors.push('Description is required')
  if (phoneDigits.length < 7 || phoneDigits.length > 15) errors.push('Invalid phone number format')
  if (input.email && !emailRegex.test(input.email)) errors.push('Invalid email format')
  if (input.website) {
    try { new URL(input.website) } catch { errors.push('Invalid website URL') }
  }
  if (!input.officeAddress) errors.push('Office address is required')
  if (!input.city) errors.push('City is required')
  if (!input.state) errors.push('State is required')
  if (!input.pinCode) errors.push('Postal code is required')
  if (!Number.isInteger(input.experienceYears) || input.experienceYears < 0 || input.experienceYears > 100) {
    errors.push('Experience years must be a whole number between 0 and 100')
  }

  return errors
}

export function slugifyAdminBroker(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'broker'
}

export const adminCreatedBrokerDefaults = {
  creationSource: 'ADMIN_CREATED' as const,
  userId: null,
  verificationStatus: 'UNVERIFIED' as const,
  brokerStatus: 'FREE' as const,
  isVisible: false,
  subscriptionPlan: 'FREE' as const,
  subscriptionActive: true,
}
