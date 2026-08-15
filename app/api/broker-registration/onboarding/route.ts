import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'

const DRAFT_FIELDS = [
  'displayName', 'companyName', 'description', 'logo', 'profileSlug',
  'phone', 'whatsapp', 'email', 'website', 'officeAddress', 'city', 'state', 'zipCode',
  'location',
  'experienceYears', 'bankPartnerships',
] as const

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'BROKER' || !user.brokerRegistration || user.brokerProfile) {
    return NextResponse.json({ error: 'Broker onboarding is not available' }, { status: 403 })
  }
  if (user.brokerRegistration.subscription?.status !== 'ACTIVE' || !user.brokerRegistration.subscription.isActive) {
    return NextResponse.json({ error: 'Subscription selection is required first' }, { status: 409 })
  }

  const body = await request.json()
  const data: Record<string, unknown> = {}
  for (const field of DRAFT_FIELDS) {
    if (field in body) data[field] = body[field]
  }
  const currentStep = Number.isInteger(body.currentStep) ? Math.max(1, Math.min(4, body.currentStep)) : 1
  const draft = user.brokerRegistration.draft
  const merged = {
    ...((draft?.data && typeof draft.data === 'object') ? draft.data : {}),
    ...data,
  }
  const jsonData = JSON.parse(JSON.stringify(merged)) as Prisma.InputJsonValue

  const updated = await prisma.brokerOnboardingDraft.upsert({
    where: { registrationId: user.brokerRegistration.id },
    update: { data: jsonData, currentStep },
    create: { registrationId: user.brokerRegistration.id, data: jsonData, currentStep },
  })
  await prisma.brokerRegistration.update({
    where: { id: user.brokerRegistration.id },
    data: { status: 'ONBOARDING_IN_PROGRESS' },
  })

  return NextResponse.json({ success: true, currentStep: updated.currentStep })
}
