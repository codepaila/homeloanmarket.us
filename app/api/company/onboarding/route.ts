import { NextRequest, NextResponse } from 'next/server'
import { CompanyType } from '@prisma/client'
import { getCurrentCompany } from '@/lib/company-policy'
import { isSameOriginRequest } from '@/lib/origin'
import prisma from '@/lib/prisma'

const companyTypes = new Set(Object.values(CompanyType))

export async function GET() {
  const current = await getCurrentCompany()
  if (!current) return NextResponse.json({ error: 'Company access required' }, { status: 403 })
  return NextResponse.json({ company: current.company })
}

export async function PATCH(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  const current = await getCurrentCompany()
  if (!current) return NextResponse.json({ error: 'Company access required' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const type = body.type
  const fields = ['address', 'contactName', 'contactPosition', 'phone', 'bannerAddress', 'bannerPhone']
  if (!name || !companyTypes.has(type) || fields.some((field) => typeof body[field] !== 'string' || !body[field].trim())) {
    return NextResponse.json({ error: 'All company onboarding fields are required' }, { status: 400 })
  }

  const company = await prisma.company.update({
    where: { id: current.company.id },
    data: {
      name,
      type: type as CompanyType,
      address: body.address.trim(),
      contactName: body.contactName.trim(),
      contactPosition: body.contactPosition.trim(),
      phone: body.phone.trim(),
      bannerAddress: body.bannerAddress.trim(),
      bannerPhone: body.bannerPhone.trim(),
      status: 'ACTIVE',
      onboardedAt: current.company.onboardedAt || new Date(),
    },
  })
  return NextResponse.json({ success: true, company })
}
