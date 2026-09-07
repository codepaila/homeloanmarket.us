import type { Prisma } from '@prisma/client'

type OwnerSubscription = {
  plan: string
  isActive: boolean
  startDate?: Date | null
  endDate?: Date | null
}

type BrokerOwnerSource = {
  id: string
  displayName: string
  companyName: string | null
  profileSlug: string
  logo: string | null
  description: string
  phone: string
  whatsapp: string | null
  email: string | null
  website: string | null
  officeAddress: string
  city: string | null
  state: string | null
  pinCode: string | null
  experienceYears: number
  socialLinks: Prisma.JsonValue | null
  nmls: string | null
  licenseStates: string[]
  brokerStatus: string
  featuredRank: number | null
  isVisible: boolean
  subscription?: OwnerSubscription | null
}

export function toBrokerOwnerDto(
  broker: BrokerOwnerSource,
) {
  return {
    id: broker.id,
    displayName: broker.displayName,
    companyName: broker.companyName,
    profileSlug: broker.profileSlug,
    logo: broker.logo,
    description: broker.description,
    phone: broker.phone,
    whatsapp: broker.whatsapp,
    email: broker.email,
    website: broker.website,
    officeAddress: broker.officeAddress,
    city: broker.city,
    state: broker.state,
    pinCode: broker.pinCode,
    experienceYears: broker.experienceYears,
    socialLinks: (broker.socialLinks ?? null) as Record<string, string | null> | null,
    nmls: broker.nmls,
    licenseStates: broker.licenseStates || [],
    brokerStatus: broker.brokerStatus,
    featuredRank: broker.featuredRank,
    isVisible: broker.isVisible,
    subscription: broker.subscription
      ? {
          plan: broker.subscription.plan,
          isActive: broker.subscription.isActive,
          startDate: broker.subscription.startDate ?? null,
          endDate: broker.subscription.endDate ?? null,
        }
      : null,
  }
}