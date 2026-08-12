import crypto from 'crypto'
import { cookies } from 'next/headers'
import prisma from '@/lib/prisma'

export const BROKER_INTENT_COOKIE = 'homeloanmarket_broker_intent'

function intentSignature() {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET is not configured')
  return crypto.createHmac('sha256', secret).update('broker-registration-intent').digest('base64url')
}

export function brokerIntentValue() {
  return intentSignature()
}

export async function hasBrokerRegistrationIntent() {
  const cookieStore = await cookies()
  return cookieStore.get(BROKER_INTENT_COOKIE)?.value === intentSignature()
}

export async function establishBrokerRegistration(userId: string) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, isActive: true },
    })
    if (!user || !user.isActive) throw new Error('Account is unavailable')
    if (user.role === 'ADMIN') throw new Error('Account cannot register as a broker')

    const existingBroker = await tx.broker.findUnique({ where: { userId }, select: { id: true } })
    if (existingBroker) return { alreadyBroker: true as const, registration: null }

    const existingRegistration = await tx.brokerRegistration.findUnique({
      where: { userId },
      include: { subscription: true, draft: true },
    })
    if (existingRegistration) {
      if (user.role !== 'BROKER') await tx.user.update({ where: { id: userId }, data: { role: 'BROKER' } })
      return { alreadyBroker: false as const, registration: existingRegistration }
    }

    const registration = await tx.brokerRegistration.create({
      data: {
        userId,
        status: 'SUBSCRIPTION_PENDING',
        draft: { create: { data: {}, currentStep: 1 } },
      },
      include: { subscription: true, draft: true },
    })
    if (user.role !== 'BROKER') await tx.user.update({ where: { id: userId }, data: { role: 'BROKER' } })

    return { alreadyBroker: false as const, registration }
  })
}
