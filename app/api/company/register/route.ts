import { NextRequest, NextResponse } from 'next/server'
import { CompanyType } from '@prisma/client'
import { hashPassword } from '@/lib/aes'
import { customerRegisterRateLimit } from '@/lib/rateLimit'
import { sendUserVerificationEmail } from '@/actions/email.action'
import { isSameOriginRequest } from '@/lib/origin'
import prisma from '@/lib/prisma'

const companyTypes = new Set(Object.values(CompanyType))

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  try {
    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const companyName = typeof body.companyName === 'string' ? body.companyName.trim() : ''
    const companyType = body.companyType
    const fields = ['address', 'contactName', 'contactPosition', 'phone', 'bannerAddress', 'bannerPhone']
    if (!name || !companyName || !email || password.length < 8 || !companyTypes.has(companyType) || fields.some((field) => typeof body[field] !== 'string' || !body[field].trim())) {
      return NextResponse.json({ error: 'All company registration fields are required' }, { status: 400 })
    }
    const rate = await customerRegisterRateLimit.limit(`company_register:${request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'}`)
    if (!rate.success) return NextResponse.json({ error: 'Too many registration attempts. Please try again later.' }, { status: 429 })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
    if (existing) return NextResponse.json({ error: 'An account with this email already exists. Please sign in.' }, { status: 409 })

    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: { name, email, password: await hashPassword(password), role: 'USER', isActive: true, emailVerified: false },
      })
      await tx.company.create({
        data: {
          name: companyName,
          type: companyType,
          address: body.address.trim(),
          contactName: body.contactName.trim(),
          contactPosition: body.contactPosition.trim(),
          phone: body.phone.trim(),
          bannerAddress: body.bannerAddress.trim(),
          bannerPhone: body.bannerPhone.trim(),
          memberships: { create: { userId: createdUser.id, role: 'OWNER', isActive: true } },
        },
      })
      return createdUser
    })
    const emailResult = await sendUserVerificationEmail(user.id)
    return NextResponse.json({ success: true, redirectTo: `/auth/verify-email?email=${encodeURIComponent(email)}`, emailSent: emailResult.success })
  } catch (error) {
    console.error('Company registration failed:', error)
    return NextResponse.json({ error: 'Failed to create company account' }, { status: 500 })
  }
}
