export type BrokerRegistrationInput = {
  name: string
  companyName?: string
  email: string
  phone: string
  password: string
  description: string
  officeAddress: string
  city: string
  state: string
  pinCode: string
}

export type BrokerAccountRegistrationInput = {
  name: string
  email: string
  password: string
}

export function normalizeBrokerAccountRegistrationInput(input: BrokerAccountRegistrationInput) {
  return {
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    password: input.password,
  }
}

export function validateBrokerAccountRegistrationInput(
  input: ReturnType<typeof normalizeBrokerAccountRegistrationInput>,
) {
  const errors: string[] = []
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  if (input.name.length < 2) errors.push('Name is required')
  if (!emailRegex.test(input.email)) errors.push('Invalid email format')
  if (input.password.length < 8) errors.push('Password must be at least 8 characters long')

  return errors
}

export function normalizeBrokerRegistrationInput(input: BrokerRegistrationInput) {
  return {
    name: input.name.trim(),
    companyName: input.companyName?.trim() || null,
    email: input.email.trim().toLowerCase(),
    phone: input.phone.trim(),
    password: input.password,
    description: input.description.trim(),
    officeAddress: input.officeAddress.trim(),
    city: input.city.trim(),
    state: input.state.trim(),
    pinCode: input.pinCode.trim(),
  }
}

export function validateBrokerRegistrationInput(input: ReturnType<typeof normalizeBrokerRegistrationInput>) {
  const errors: string[] = []
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const phoneDigits = input.phone.replace(/\D/g, '')

  if (input.name.length < 2) errors.push('Name is required')
  if (!emailRegex.test(input.email)) errors.push('Invalid email format')
  if (phoneDigits.length < 7 || phoneDigits.length > 15) errors.push('Invalid phone number format')
  if (input.password.length < 8) errors.push('Password must be at least 8 characters long')
  if (!input.description) errors.push('Description is required')
  if (!input.officeAddress) errors.push('Office address is required')
  if (!input.city) errors.push('City is required')
  if (!input.state) errors.push('State is required')
  if (!input.pinCode) errors.push('Postal code is required')

  return errors
}

export function slugifyBrokerName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'broker'
}

export const selfRegisteredBrokerDefaults = {
  role: 'BROKER' as const,
  creationSource: 'SELF_REGISTERED' as const,
  verificationStatus: 'UNVERIFIED' as const,
  brokerStatus: 'FREE' as const,
  isVisible: true,
  subscriptionPlan: 'FREE' as const,
  subscriptionActive: true,
}

import prisma from '@/lib/prisma'
import { hashPassword } from '@/lib/aes'
import { BankType, SubscriptionPlan } from '@prisma/client'

export async function createBrokerRegistration(input: BrokerAccountRegistrationInput) {
  const normalized = normalizeBrokerAccountRegistrationInput(input)
  const errors = validateBrokerAccountRegistrationInput(normalized)
  if (errors.length > 0) {
    throw new Error(errors[0])
  }

  const hashedPassword = await hashPassword(normalized.password)

  return prisma.$transaction(async (tx) => {
    const existingUser = await tx.user.findUnique({
      where: { email: normalized.email },
      select: { id: true },
    })
    if (existingUser) {
      const error = new Error('ACCOUNT_ALREADY_REGISTERED')
      error.name = 'DuplicateAccountError'
      throw error
    }

    const user = await tx.user.create({
      data: {
        name: normalized.name,
        email: normalized.email,
        password: hashedPassword,
        role: 'BROKER',
        isActive: true,
        emailVerified: false,
        agreeToTerms: true,
        agreeToPrivacy: true,
      },
    })

    const registration = await tx.brokerRegistration.create({
      data: {
        userId: user.id,
        status: 'SUBSCRIPTION_PENDING',
        draft: {
          create: {
            data: {},
            currentStep: 1,
          },
        },
      },
      include: { draft: true },
    })

    return { user, registration }
  })
}

export async function createBrokerAccount(input: BrokerRegistrationInput) {
  const normalized = normalizeBrokerRegistrationInput(input)
  const hashedPassword = await hashPassword(normalized.password)

  return prisma.$transaction(async (tx) => {
    const existingUser = await tx.user.findFirst({
      where: { OR: [{ email: normalized.email }, { phone: normalized.phone }] },
      select: { id: true },
    })
    if (existingUser) {
      const error = new Error('ACCOUNT_ALREADY_REGISTERED')
      error.name = 'DuplicateAccountError'
      throw error
    }

    const displayName = normalized.name
    const baseSlug = slugifyBrokerName(normalized.companyName || displayName)
    let profileSlug = baseSlug
    let suffix = 1
    while (await tx.broker.findUnique({ where: { profileSlug } })) {
      suffix += 1
      profileSlug = `${baseSlug}-${suffix}`
    }

    const user = await tx.user.create({
      data: {
        name: displayName,
        email: normalized.email,
        phone: normalized.phone,
        password: hashedPassword,
        role: selfRegisteredBrokerDefaults.role,
        isActive: true,
        emailVerified: false,
        agreeToTerms: true,
        agreeToPrivacy: true,
      },
    })

    const broker = await tx.broker.create({
      data: {
        userId: user.id,
        creationSource: selfRegisteredBrokerDefaults.creationSource,
        displayName,
        companyName: normalized.companyName,
        profileSlug,
        description: normalized.description,
        phone: normalized.phone,
        email: normalized.email,
        officeAddress: normalized.officeAddress,
        city: normalized.city,
        state: normalized.state,
        pinCode: normalized.pinCode,
        verificationStatus: selfRegisteredBrokerDefaults.verificationStatus,
        brokerStatus: selfRegisteredBrokerDefaults.brokerStatus,
        isVisible: selfRegisteredBrokerDefaults.isVisible,
        subscription: {
          create: {
            plan: selfRegisteredBrokerDefaults.subscriptionPlan,
            isActive: selfRegisteredBrokerDefaults.subscriptionActive,
            startDate: new Date(),
            endDate: null,
          },
        },
      },
    })

    return { user, broker }
  })
}

export type ExistingUserBrokerInput = {
  displayName: string
  companyName?: string | null
  description?: string
  profileSlug?: string
  phone: string
  whatsapp?: string | null
  email?: string | null
  website?: string | null
  // When a `location` is supplied the structured office fields are derived
  // from it server-side, so these are optional fallbacks.
  officeAddress?: string
  city?: string
  state?: string
  pinCode?: string
  experienceYears?: number
  bankPartnerships?: string[]
  registrationNumber?: string | null
  panNumber?: string | null
  nmls?: string
  licenseStates?: string[]
  logo?: string
  profileImage?: string
  coverImage?: string
  location?: {
    placeId?: string
    normalizedAddress: string
    city: string
    state: string
    zip: string
    countryCode: 'US'
    latitude: number
    longitude: number
  }
}

export async function finalizeBrokerRegistration(
  userId: string,
  dataOverride?: Partial<ExistingUserBrokerInput>,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.broker.findFirst({ where: { userId } })
    if (existing) {
      return existing
    }

    const registration = await tx.brokerRegistration.findUnique({
      where: { userId },
      include: { subscription: true, draft: true },
    })
    if (!registration) {
      const error = new Error('Broker registration not found')
      error.name = 'RegistrationNotFoundError'
      throw error
    }

    const selectedSubscription = registration.subscription
    if (!selectedSubscription || !selectedSubscription.isActive || selectedSubscription.status !== 'ACTIVE') {
      const error = new Error('An active broker subscription is required before onboarding')
      error.name = 'BrokerSubscriptionRequiredError'
      throw error
    }

    const rawDraft = registration.draft?.data && typeof registration.draft.data === 'object' && !Array.isArray(registration.draft.data)
      ? (registration.draft.data as Record<string, unknown>)
      : {}
    const merged: Record<string, unknown> = {
      ...rawDraft,
      ...(dataOverride || {}),
    }

    const displayName = typeof merged.displayName === 'string' ? merged.displayName.trim() : ''
    const phone = typeof merged.phone === 'string' ? merged.phone.trim() : ''
    const description = typeof merged.description === 'string' ? merged.description.trim() : ''
    const nmls = typeof merged.nmls === 'string' ? merged.nmls.trim() : ''
    const licenseStates = Array.isArray(merged.licenseStates) ? (merged.licenseStates as string[]) : []

    if (!displayName || displayName.length < 2) {
      throw new Error('Display name must be at least 2 characters')
    }
    if (!phone || phone.replace(/\D/g, '').length < 7) {
      throw new Error('Phone number must be at least 7 digits')
    }
    if (!description || description.length < 20) {
      throw new Error('Description must be at least 20 characters')
    }
    if (!nmls || !/^\d{4,10}$/.test(nmls)) {
      throw new Error('NMLS ID must be 4–10 digits')
    }
    if (licenseStates.length === 0) {
      throw new Error('Select at least one licensed state')
    }

    const location = merged.location && typeof merged.location === 'object' ? (merged.location as ExistingUserBrokerInput['location']) : undefined
    const officeAddress = location?.normalizedAddress || (typeof merged.officeAddress === 'string' ? merged.officeAddress : '')
    const city = location?.city || (typeof merged.city === 'string' ? merged.city : '')
    const state = location?.state || (typeof merged.state === 'string' ? merged.state : '')
    const pinCode = location?.zip || (typeof merged.pinCode === 'string' ? merged.pinCode : typeof merged.zipCode === 'string' ? merged.zipCode : '')

    // profileSlug is SERVER-GENERATED and NEVER a user/client input. It is
    // derived from the canonical display source (companyName, else displayName)
    // and made unique deterministically. A client-supplied slug (e.g. from an
    // older draft or a tampered payload) is intentionally ignored — the server
    // remains authoritative. Existing Brokers already have a slug preserved
    // because finalization returns early for an existing Broker.
    const slugSource = (typeof merged.companyName === 'string' && merged.companyName.trim()) || displayName
    const baseSlug = slugifyBrokerName(slugSource)
    let profileSlug = baseSlug
    let suffix = 1
    while (await tx.broker.findUnique({ where: { profileSlug } })) {
      suffix += 1
      profileSlug = `${slugifyBrokerName(slugSource)}-${suffix}`
    }

    const dbPlan = await tx.brokerSubscriptionPlan.findFirst({
      where: { code: selectedSubscription.plan, isActive: true },
      select: { id: true },
    })

    const broker = await tx.broker.create({
      data: {
        userId,
        creationSource: 'SELF_REGISTERED',
        displayName,
        companyName: (typeof merged.companyName === 'string' && merged.companyName.trim()) || null,
        description,
        profileSlug,
        phone,
        whatsapp: (typeof merged.whatsapp === 'string' && merged.whatsapp.trim()) || null,
        email: (typeof merged.email === 'string' && merged.email.trim()) || null,
        website: (typeof merged.website === 'string' && merged.website.trim()) || null,
        logo: typeof merged.logo === 'string' ? merged.logo : null,
        profileImage: typeof merged.profileImage === 'string' ? merged.profileImage : null,
        coverImage: typeof merged.coverImage === 'string' ? merged.coverImage : null,
        officeAddress,
        city,
        state,
        pinCode,
        normalizedAddress: location?.normalizedAddress || officeAddress,
        googlePlaceId: location?.placeId || (typeof merged.googlePlaceId === 'string' ? merged.googlePlaceId : null),
        locationCountryCode: location?.countryCode || 'US',
        location: location?.longitude != null && location?.latitude != null
          ? JSON.parse(JSON.stringify({ type: 'Point', coordinates: [location.longitude, location.latitude] }))
          : undefined,
        experienceYears: Number(merged.experienceYears) || 0,
        registrationNumber: typeof merged.registrationNumber === 'string' ? merged.registrationNumber.trim() : null,
        panNumber: typeof merged.panNumber === 'string' ? merged.panNumber.trim() : null,
        nmls,
        licenseStates,
        verificationStatus: 'UNVERIFIED',
        brokerStatus: 'FREE',
        isVisible: true,
        mortgageExpertEnabled: false,
        subscription: {
          create: {
            plan: selectedSubscription.plan,
            planId: dbPlan?.id ?? null,
            isActive: selectedSubscription.isActive,
            startDate: selectedSubscription.startDate || new Date(),
            endDate: selectedSubscription.endDate ?? undefined,
            stripeCustomerId: selectedSubscription.stripeCustomerId ?? undefined,
            stripeSubId: selectedSubscription.stripeSubId ?? undefined,
          },
        },
      },
    })

    const bankPartnerships = Array.isArray(merged.bankPartnerships) ? (merged.bankPartnerships as string[]) : []
    if (bankPartnerships.length > 0) {
      await tx.brokerBank.createMany({
        data: bankPartnerships.map((bankName) => ({
          brokerId: broker.id,
          bankName,
          bankType: 'PRIVATE' as BankType,
        })),
      })
    }

    await tx.user.update({ where: { id: userId }, data: { role: 'BROKER' } })
    await tx.brokerRegistration.update({
      where: { id: registration.id },
      data: { status: 'COMPLETED' },
    })
    if (registration.draft) {
      await tx.brokerOnboardingDraft.update({
        where: { id: registration.draft.id },
        data: { completedAt: new Date(), currentStep: 5 },
      })
    }
    return broker
  })
}

export async function createBrokerForExistingUser(userId: string, data: ExistingUserBrokerInput) {
  return finalizeBrokerRegistration(userId, data)
}
