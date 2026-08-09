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
import { BankType } from '@prisma/client'
import { assertServiceCityLimit } from '@/lib/broker-policy'

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
}

export async function createBrokerForExistingUser(userId: string, data: ExistingUserBrokerInput) {
  // A newly created broker always starts on the FREE plan, so the FREE
  // service-city allowance (1 city) applies at creation. Server-side
  // enforcement only — the client can never claim paid entitlement.
  const limit = assertServiceCityLimit(data.serviceCities, null)
  if (!limit.ok) {
    const error = new Error(limit.reason)
    error.name = 'ServiceCityLimitError'
    throw error
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.broker.findUnique({ where: { userId }, select: { id: true } })
    if (existing) {
      const error = new Error('ALREADY_A_BROKER')
      error.name = 'AlreadyBrokerError'
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
        experienceYears: data.experienceYears || 0,
        specializations: data.specializations?.length ? data.specializations : ['Home Loan'],
        serviceCities: data.serviceCities || [],
        languages: data.languages?.length ? data.languages : ['English', 'Hindi'],
        verificationStatus: 'UNVERIFIED',
        brokerStatus: 'FREE',
        isVisible: true,
        subscription: {
          create: { plan: 'FREE', isActive: true, startDate: new Date(), endDate: null },
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
    return broker
  })
}
