import crypto from 'crypto'
import { cookies } from 'next/headers'
import prisma from '@/lib/prisma'

export const COMPANY_INTENT_COOKIE = 'homeloanmarket_company_intent'

function intentSignature() {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET is not configured')
  return crypto.createHmac('sha256', secret).update('company-registration-intent').digest('base64url')
}

export function companyIntentValue() {
  return intentSignature()
}

export async function hasCompanyRegistrationIntent() {
  const cookieStore = await cookies()
  return cookieStore.get(COMPANY_INTENT_COOKIE)?.value === intentSignature()
}

// Sentinel raised when the Google company path must capture explicit legal
// consent before a Company can be established (the consent endpoint persists
// it on the user record). Authentication is never treated as consent.
export class CompanyConsentRequiredError extends Error {
  constructor() {
    super('Legal consent is required before completing company registration')
    this.name = 'CompanyConsentRequiredError'
  }
}

// Creates a PENDING company shell + OWNER membership for a company-intent user
// (Google signup). Real business fields are collected later during company
// onboarding; this shell only establishes the company flow so the company can
// reach plan selection/subscription.
//
// Concurrency-safe: the CompanyMembership unique index (userId, role=OWNER)
// guarantees at most one OWNER membership per user. When two requests race to
// establish a company for the same user, only one create wins and the loser
// converges on the existing company instead of creating a duplicate.
export async function establishCompanyForUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, isActive: true, name: true, agreeToTerms: true, agreeToPrivacy: true },
  })
  if (!user || !user.isActive) throw new Error('Account is unavailable')
  if (user.role === 'ADMIN') throw new Error('Account cannot register as a company')

  const existingMembership = await prisma.companyMembership.findFirst({
    where: { userId, isActive: true },
    select: { id: true, companyId: true },
  })
  if (existingMembership) return { alreadyCompany: true as const, companyId: existingMembership.companyId }

  // Explicit legal consent is required before creating a new Company (Google
  // account creation happens before consent). Existing owners continue
  // unimpeded.
  if (user.agreeToTerms !== true || user.agreeToPrivacy !== true) {
    throw new CompanyConsentRequiredError()
  }

  try {
    const company = await prisma.$transaction(async (tx) => {
      return tx.company.create({
        data: {
          name: user.name || 'My Company',
          type: 'OTHER',
          address: '',
          contactName: '',
          contactPosition: '',
          phone: '',
          bannerAddress: '',
          bannerPhone: '',
          status: 'PENDING',
          memberships: { create: { userId, role: 'OWNER', isActive: true } },
        },
      })
    })
    return { alreadyCompany: false as const, companyId: company.id }
  } catch (error) {
    // A concurrent request created the company first; the unique
    // (userId, role=OWNER) index rejects the duplicate. Converge on the
    // existing company.
    if ((error as { code?: string } | null)?.code === 'P2002') {
      const membership = await prisma.companyMembership.findFirst({
        where: { userId, isActive: true },
        select: { id: true, companyId: true },
      })
      if (membership) return { alreadyCompany: true as const, companyId: membership.companyId }
    }
    throw error
  }
}

