type OwnerSubscription = {
  plan: string
  isActive: boolean
  startDate?: Date | null
  endDate?: Date | null
}

type OwnerBank = {
  id: string
  bankName: string
  bankType: string
  since?: Date | null
}

type OwnerReview = {
  id?: string
  rating: number
  comment: string | null
  createdAt: Date
  user?: { name: string | null; image?: string | null } | null
}

type BrokerOwnerSource = {
  id: string
  displayName: string
  companyName: string | null
  profileSlug: string
  logo: string | null
  coverImage: string | null
  description: string
  phone: string
  whatsapp: string | null
  email: string | null
  website: string | null
  officeAddress: string
  city: string
  state: string
  pinCode: string
  experienceYears: number
  specializations: string[]
  serviceCities: string[]
  languages: string[]
  registrationNumber: string | null
  panNumber: string | null
  verificationStatus: string
  verifiedAt: Date | null
  brokerStatus: string
  featuredRank: number | null
  isVisible: boolean
  avgRating: number
  totalReviews: number
  totalLeads: number
  profileViews: number
  subscription?: OwnerSubscription | null
  bankPartners?: OwnerBank[]
  reviews?: OwnerReview[]
}

export function toBrokerOwnerDto(
  broker: BrokerOwnerSource,
  derived: { monthlyLeads?: number } = {},
) {
  return {
    id: broker.id,
    displayName: broker.displayName,
    companyName: broker.companyName,
    profileSlug: broker.profileSlug,
    logo: broker.logo,
    coverImage: broker.coverImage,
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
    specializations: broker.specializations,
    serviceCities: broker.serviceCities,
    languages: broker.languages,
    registrationNumber: broker.registrationNumber,
    panNumber: broker.panNumber,
    verificationStatus: broker.verificationStatus,
    verifiedAt: broker.verifiedAt,
    brokerStatus: broker.brokerStatus,
    featuredRank: broker.featuredRank,
    isVisible: broker.isVisible,
    avgRating: broker.avgRating,
    totalReviews: broker.totalReviews,
    totalLeads: broker.totalLeads,
    profileViews: broker.profileViews,
    monthlyLeads: derived.monthlyLeads ?? 0,
    subscription: broker.subscription
      ? {
          plan: broker.subscription.plan,
          isActive: broker.subscription.isActive,
          startDate: broker.subscription.startDate ?? null,
          endDate: broker.subscription.endDate ?? null,
        }
      : null,
    bankPartners: (broker.bankPartners || []).map((bank) => ({
      id: bank.id,
      bankName: bank.bankName,
      bankType: bank.bankType,
      since: bank.since ?? null,
    })),
    reviews: (broker.reviews || []).map((review) => ({
      ...(review.id ? { id: review.id } : {}),
      rating: review.rating,
      comment: review.comment ?? '',
      createdAt: review.createdAt,
      user: review.user
        ? { name: review.user.name, image: review.user.image ?? null }
        : null,
    })),
  }
}
