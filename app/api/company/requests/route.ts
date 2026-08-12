import { NextRequest, NextResponse } from 'next/server'
import { getCurrentCompany } from '@/lib/company-policy'
import { isSameOriginRequest } from '@/lib/origin'
import prisma from '@/lib/prisma'

export async function GET() {
  const current = await getCurrentCompany()
  if (!current) return NextResponse.json({ error: 'Company access required' }, { status: 403 })
  const requests = await prisma.companyAdRequest.findMany({ where: { companyId: current.company.id }, orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ requests })
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  const current = await getCurrentCompany()
  if (!current) return NextResponse.json({ error: 'Company access required' }, { status: 403 })
  const body = await request.json()
  const details = typeof body.requestDetails === 'string' ? body.requestDetails.trim() : ''
  if (!details) return NextResponse.json({ error: 'Advertising request details are required' }, { status: 400 })
  const requestRecord = await prisma.companyAdRequest.create({
    data: { companyId: current.company.id, requestedById: current.user.id, requestDetails: details },
  })
  return NextResponse.json({ success: true, request: requestRecord }, { status: 201 })
}
