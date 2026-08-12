import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import { CompanyAdRequestStatus } from '@prisma/client'
import prisma from '@/lib/prisma'

export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const requests = await prisma.companyAdRequest.findMany({ include: { company: true }, orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ requests })
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  if (typeof body.id !== 'string' || !Object.values(CompanyAdRequestStatus).includes(body.status)) return NextResponse.json({ error: 'Valid request ID and status are required' }, { status: 400 })
  const requestRecord = await prisma.companyAdRequest.findUnique({ where: { id: body.id }, select: { companyId: true } })
  if (!requestRecord) return NextResponse.json({ error: 'Advertisement request not found' }, { status: 404 })
  const advertisementId = typeof body.advertisementId === 'string' ? body.advertisementId : undefined
  const updated = await prisma.$transaction(async (tx) => {
    if (advertisementId) {
      await tx.advertisement.update({ where: { id: advertisementId }, data: { companyId: requestRecord.companyId } })
    }
    if (body.status === 'APPROVED' || body.status === 'FULFILLED') {
      await tx.company.update({ where: { id: requestRecord.companyId }, data: { status: 'ACTIVE' } })
    }
    return tx.companyAdRequest.update({ where: { id: body.id }, data: { status: body.status, reviewedById: user.id, reviewedAt: new Date(), advertisementId } })
  })
  return NextResponse.json({ success: true, request: updated })
}
