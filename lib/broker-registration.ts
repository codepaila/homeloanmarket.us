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
import { assertServiceCityLimit, hasPaidEntitlement } from '@/lib/broker-policy'

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
      profileSlug = `${baseSlug}-${suffix}`
      suffix += 1
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
  email?: string | null
  officeAddress: string
  city: string
  state: string
  pinCode: string
  experienceYears?: number
  specializations?: string[]
  serviceCities?: string[]
  languages?: string[]
  bankPartnerships?: string[]
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

type RegistrationSubscription = {
  plan: SubscriptionPlan
  isActive: boolean
  startDate?: Date | null
  endDate?: Date | null
  stripeCustomerId?: string | null
  stripeSubId?: string | null
}

export async function createBrokerForExistingUser(userId: string, data: ExistingUserBrokerInput) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.broker.findUnique({ where: { userId }, select: { id: true } })
    if (existing) {
      const error = new Error('ALREADY_A_BROKER')
      error.name = 'AlreadyBrokerError'
      throw error
    }

    const registration = await tx.brokerRegistration.findUnique({
      where: { userId },
      include: { subscription: true, draft: true },
    })
    const selectedSubscription: RegistrationSubscription = registration?.subscription || {
      plan: 'FREE',
      isActive: true,
      startDate: new Date(),
      endDate: null,
    }
    if (registration && (registration.status === 'INTENT_SELECTED' || !registration.subscription?.isActive || registration.subscription.status !== 'ACTIVE')) {
      const error = new Error('An active broker subscription is required before onboarding')
      error.name = 'BrokerSubscriptionRequiredError'
      throw error
    }

    const freeLimit = assertServiceCityLimit(data.serviceCities, null)
    const limit = hasPaidEntitlement(selectedSubscription)
      ? { ok: true as const, max: Infinity }
      : freeLimit
    if (!limit.ok) {
      const error = new Error(limit.reason)
      error.name = 'ServiceCityLimitError'
      throw error
    }

    const displayName = data.displayName.trim()
    const slugSource = data.companyName?.trim() || displayName
    const baseSlug = data.profileSlug?.trim() ? data.profileSlug.trim() : slugifyBrokerName(slugSource)
    let profileSlug = baseSlug
    let suffix = 1
    while (await tx.broker.findUnique({ where: { profileSlug } })) {
      profileSlug = `${slugifyBrokerName(slugSource)}-${suffix}`
      suffix += 1
    }

    const broker = await tx.broker.create({
      data: {
        userId,
        creationSource: 'SELF_REGISTERED',
        displayName,
        companyName: data.companyName || null,
        description: data.description || '',
        profileSlug,
        phone: data.phone,
        email: data.email || null,
        officeAddress: data.officeAddress,
        city: data.city,
        state: data.state,
        pinCode: data.pinCode,
        normalizedAddress: data.location?.normalizedAddress || data.officeAddress,
        googlePlaceId: data.location?.placeId,
        locationCountryCode: data.location?.countryCode || 'US',
        location: data.location
          ? JSON.parse(JSON.stringify({ type: 'Point', coordinates: [data.location.longitude, data.location.latitude] }))
          : undefined,
        experienceYears: data.experienceYears || 0,
        specializations: data.specializations?.length ? data.specializations : ['Home Loan'],
        serviceCities: data.serviceCities || [],
        languages: data.languages?.length ? data.languages : ['English', 'Hindi'],
        verificationStatus: 'UNVERIFIED',
        brokerStatus: 'FREE',
        isVisible: true,
        subscription: {
          create: {
            plan: selectedSubscription.plan,
            isActive: selectedSubscription.isActive,
            startDate: selectedSubscription.startDate || new Date(),
            endDate: selectedSubscription.endDate ?? undefined,
            stripeCustomerId: selectedSubscription.stripeCustomerId ?? undefined,
            stripeSubId: selectedSubscription.stripeSubId ?? undefined,
          },
        },
      },
    })

    if (data.bankPartnerships?.length) {
      await tx.brokerBank.createMany({
        data: data.bankPartnerships.map((bankName) => ({
          brokerId: broker.id,
          bankName,
          bankType: 'PRIVATE' as BankType,
        })),
      })
    }

    await tx.user.update({ where: { id: userId }, data: { role: 'BROKER' } })
    if (registration) {
      await tx.brokerRegistration.update({
        where: { id: registration.id },
        data: { status: 'COMPLETED' },
      })
      if (registration.draft) {
        await tx.brokerOnboardingDraft.update({
          where: { id: registration.draft.id },
          data: { completedAt: new Date(), currentStep: 4 },
        })
      }
    }
    return broker
  })
}
