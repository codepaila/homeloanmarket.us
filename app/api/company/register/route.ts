import { NextRequest, NextResponse } from 'next/server'
import { hashPassword } from '@/lib/aes'
import { customerRegisterRateLimit } from '@/lib/rateLimit'
import { sendUserVerificationEmail } from '@/actions/email.action'
import { isSameOriginRequest } from '@/lib/origin'
import prisma from '@/lib/prisma'

// Account-only company registration. Company business fields (name, type,
// address, contacts, banner) are collected during company onboarding AFTER the
// company advertising plan is selected/activated. A PENDING company shell is
// created here only so the company-scoped subscription/dashboard can be
// attached during the pre-onboarding phase; onboarding completes it.
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  try {
    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const agreeToTerms = body?.agreeToTerms === true
    const agreeToPrivacy = body?.agreeToPrivacy === true

    if (!name) return NextResponse.json({ error: 'Full name is required.' }, { status: 400 })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
    if (password.length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
    // Legal consent is server-authoritative; a client checkbox alone is never
    // sufficient. Both agreements must be explicitly true.
    if (!agreeToTerms || !agreeToPrivacy) {
      return NextResponse.json({ error: 'You must agree to both the Terms & Conditions and Privacy Policy.' }, { status: 400 })
    }

    const rate = await customerRegisterRateLimit.limit(`company_register:${request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'}`)
    if (!rate.success) return NextResponse.json({ error: 'Too many registration attempts. Please try again later.' }, { status: 429 })

    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
    if (existing) return NextResponse.json({ error: 'An account with this email already exists. Please sign in.' }, { status: 409 })

    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: { name, email, password: await hashPassword(password), role: 'USER', isActive: true, emailVerified: false, agreeToTerms, agreeToPrivacy },
      })
      await tx.company.create({
        data: {
          name,
          type: 'OTHER',
          address: '',
          contactName: '',
          contactPosition: '',
          phone: '',
          bannerAddress: '',
          bannerPhone: '',
          status: 'PENDING',
          memberships: { create: { userId: createdUser.id, role: 'OWNER', isActive: true } },
        },
      })
      return createdUser
    })
    const emailResult = await sendUserVerificationEmail(user.id)
    return NextResponse.json({ success: true, redirectTo: `/auth/verify-email?email=${encodeURIComponent(email)}`, emailSent: emailResult.success })
  } catch (error) {
    // User.email is the authoritative uniqueness constraint. A concurrent
    // duplicate registration surfaces as a Prisma unique-constraint failure;
    // map it to the same duplicate-account response without leaking internals.
    if ((error as { code?: string } | null)?.code === 'P2002') {
      return NextResponse.json({ error: 'An account with this email already exists. Please sign in.' }, { status: 409 })
    }
    console.error('Company registration failed:', error)
    return NextResponse.json({ error: 'Failed to create company account' }, { status: 500 })
  }
}
