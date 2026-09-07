import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import prisma from '@/lib/prisma'
import { normalizeLicenseStates } from '@/lib/broker-licensing'
import { isSameOriginRequest } from '@/lib/origin'
import { Prisma } from '@prisma/client'

const DRAFT_FIELDS = [
  'displayName', 'companyName', 'description', 'logo', 'profileSlug',
  'phone', 'whatsapp', 'email', 'website',
  'officeAddress', 'city', 'state', 'pinCode', 'zipCode',
  'googlePlaceId', 'locationCountryCode', 'location',
  'experienceYears', 'bankPartnerships',
  'nmls', 'licenseStates',
  'profileImage', 'coverImage',
] as const

export async function PATCH(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'BROKER' || !user.brokerRegistration || user.brokerProfile) {
    return NextResponse.json({ error: 'Broker onboarding is not available' }, { status: 403 })
  }

  const body = await request.json()
  const data: Record<string, unknown> = {}
  for (const field of DRAFT_FIELDS) {
    if (field in body) data[field] = body[field]
  }
  // The canonical schema field for a US postal code is `pinCode`; older drafts
  // and clients may still send `zipCode`. Normalize to `pinCode` so a resumed
  // draft always restores the canonical field.
  if ('zipCode' in data) {
    if (!('pinCode' in data) || data.pinCode === '' || data.pinCode == null) data.pinCode = data.zipCode
    delete data.zipCode
  }
  // Normalize licensing draft values so a resumed draft always restores a
  // clean NMLS string and a proper licenseStates array (never a stray string).
  if ('nmls' in data) data.nmls = typeof data.nmls === 'string' ? data.nmls.trim() : ''
  if ('licenseStates' in data) {
    const states = normalizeLicenseStates(data.licenseStates)
    data.licenseStates = states.length > 0 ? states : []
  }
  const currentStep = Number.isInteger(body.currentStep) ? Math.max(1, Math.min(5, body.currentStep)) : 1
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
