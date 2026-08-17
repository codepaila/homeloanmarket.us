import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import { CompanyAdRequestStatus } from '@prisma/client'
import prisma from '@/lib/prisma'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const requestRecord = await prisma.companyAdRequest.findUnique({ where: { id } })
  if (!requestRecord) return NextResponse.json({ error: 'Advertisement request not found' }, { status: 404 })

  const [company, advertisement, requestedBy, reviewedBy] = await Promise.all([
    prisma.company.findUnique({
      where: { id: requestRecord.companyId },
      include: {
        subscription: { include: { advertisingPlan: { select: { name: true } } } },
        memberships: { select: { id: true, role: true, user: { select: { id: true, name: true, email: true } } } },
      },
    }),
    requestRecord.advertisementId
      ? prisma.advertisement.findUnique({
          where: { id: requestRecord.advertisementId },
          select: { id: true, title: true, placement: true, isEnabled: true, isArchived: true, startDate: true, endDate: true, locationTarget: true, company: { select: { name: true } } },
        })
      : null,
    prisma.user.findUnique({ where: { id: requestRecord.requestedById }, select: { id: true, name: true, email: true } }),
    requestRecord.reviewedById ? prisma.user.findUnique({ where: { id: requestRecord.reviewedById }, select: { id: true, name: true, email: true } }) : null,
  ])

  return NextResponse.json({
    request: {
      ...requestRecord,
      company,
      advertisement,
      requestedBy,
      reviewedBy,
    },
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const body = await request.json()
  const status = body.status as CompanyAdRequestStatus | undefined
  if (status !== undefined && !Object.values(CompanyAdRequestStatus).includes(status)) {
    return NextResponse.json({ error: 'Valid status is required' }, { status: 400 })
  }
  const advertisementId = typeof body.advertisementId === 'string' && body.advertisementId ? body.advertisementId : undefined

  const existing = await prisma.companyAdRequest.findUnique({ where: { id }, select: { companyId: true } })
  if (!existing) return NextResponse.json({ error: 'Advertisement request not found' }, { status: 404 })

  await prisma.$transaction(async (tx) => {
    if (advertisementId) {
      await tx.advertisement.update({ where: { id: advertisementId }, data: { companyId: existing.companyId } })
    }
    if (status === 'APPROVED' || status === 'FULFILLED') {
      await tx.company.update({ where: { id: existing.companyId }, data: { status: 'ACTIVE' } })
    }
    await tx.companyAdRequest.update({
      where: { id },
      data: {
        ...(status !== undefined ? { status } : {}),
        ...(advertisementId !== undefined ? { advertisementId } : {}),
        reviewedById: user.id,
        reviewedAt: new Date(),
      },
    })
  })

  const updated = await prisma.companyAdRequest.findUnique({ where: { id } })
  const [company, advertisement, requestedBy, reviewedBy] = await Promise.all([
    prisma.company.findUnique({ where: { id: updated!.companyId }, include: { subscription: { include: { advertisingPlan: { select: { name: true } } } }, memberships: { select: { id: true, role: true, user: { select: { id: true, name: true, email: true } } } } } }),
    updated!.advertisementId ? prisma.advertisement.findUnique({ where: { id: updated!.advertisementId }, select: { id: true, title: true, placement: true, isEnabled: true, isArchived: true, startDate: true, endDate: true, locationTarget: true, company: { select: { name: true } } } }) : null,
    prisma.user.findUnique({ where: { id: updated!.requestedById }, select: { id: true, name: true, email: true } }),
    updated!.reviewedById ? prisma.user.findUnique({ where: { id: updated!.reviewedById }, select: { id: true, name: true, email: true } }) : null,
  ])
  return NextResponse.json({ success: true, request: { ...updated, company, advertisement, requestedBy, reviewedBy } })
}
