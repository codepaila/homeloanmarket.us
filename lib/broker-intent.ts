import crypto from 'crypto'
import { cookies } from 'next/headers'
import prisma from '@/lib/prisma'
import { SUPPORTED_BROKER_PLAN_CODES, type SupportedBrokerPlanCode } from '@/lib/broker-plans'

export const BROKER_INTENT_COOKIE = 'homeloanmarket_broker_intent'
type SupportedBrokerPlan = SupportedBrokerPlanCode

function intentSignature() {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET is not configured')
  return crypto.createHmac('sha256', secret).update('broker-registration-intent').digest('base64url')
}

function isValidPlan(plan: unknown): plan is SupportedBrokerPlan {
  return typeof plan === 'string' && (SUPPORTED_BROKER_PLAN_CODES as readonly string[]).includes(plan)
}

function parseBrokerIntentCookie(value: string): { sig: string; plan: SupportedBrokerPlan | null } {
  try {
    const parsed = JSON.parse(value)
    if (parsed && typeof parsed.sig === 'string' && parsed.sig.length > 0) {
      return { sig: parsed.sig, plan: isValidPlan(parsed.plan) ? parsed.plan : null }
    }
  } catch {
    // Legacy raw HMAC cookie — treat the entire value as the signature.
  }
  return { sig: value, plan: null }
}

export function brokerIntentValue(plan?: string | null) {
  const sig = intentSignature()
  const validatedPlan = isValidPlan(plan) ? plan : null
  return JSON.stringify({ sig, plan: validatedPlan })
}

export async function hasBrokerRegistrationIntent() {
  const cookieStore = await cookies()
  const raw = cookieStore.get(BROKER_INTENT_COOKIE)?.value
  if (!raw) return false
  const { sig } = parseBrokerIntentCookie(raw)
  return sig === intentSignature()
}

export async function getBrokerRegistrationIntentPlan(): Promise<SupportedBrokerPlan | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(BROKER_INTENT_COOKIE)?.value
  if (!raw) return null
  const { sig, plan } = parseBrokerIntentCookie(raw)
  if (sig !== intentSignature()) return null
  return plan
}

export async function establishBrokerRegistration(userId: string) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, isActive: true },
    })
    if (!user || !user.isActive) throw new Error('Account is unavailable')
    if (user.role === 'ADMIN') throw new Error('Account cannot register as a broker')

    const existingBroker = await tx.broker.findFirst({ where: { userId }, select: { id: true } })
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
