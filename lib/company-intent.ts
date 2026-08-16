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

// Creates a PENDING company shell + OWNER membership for a company-intent user
// (Google signup). Real business fields are collected later during company
// onboarding; this shell only establishes the company flow so the company can
// reach plan selection/subscription.
export async function establishCompanyForUser(userId: string) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, isActive: true, name: true },
    })
    if (!user || !user.isActive) throw new Error('Account is unavailable')
    if (user.role === 'ADMIN') throw new Error('Account cannot register as a company')

    const existingMembership = await tx.companyMembership.findFirst({
      where: { userId, isActive: true },
      select: { id: true, companyId: true },
    })
    if (existingMembership) return { alreadyCompany: true as const, companyId: existingMembership.companyId }

    const company = await tx.company.create({
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
    return { alreadyCompany: false as const, companyId: company.id }
  })
}

