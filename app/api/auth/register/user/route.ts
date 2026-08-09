/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { hashPassword } from '@/lib/aes'
import { customerRegisterRateLimit } from '@/lib/rateLimit'
import { sendUserVerificationEmail } from '@/actions/email.action'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''

    if (!name) {
      return NextResponse.json({ success: false, error: 'Name is required.' }, { status: 400 })
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ success: false, error: 'Please enter a valid email address.' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ success: false, error: 'Password must be at least 8 characters.' }, { status: 400 })
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    const { success } = await customerRegisterRateLimit.limit(`user_register:${ip}`)
    if (!success) {
      return NextResponse.json({ success: false, error: 'Too many registration attempts. Please try again later.' }, { status: 429 })
    }

    const existing = await prisma.user.findFirst({ where: { email }, select: { id: true } })
    if (existing) {
      return NextResponse.json({ success: false, error: 'An account with this email already exists. Please sign in.' }, { status: 409 })
    }

    const hashedPassword = await hashPassword(password)
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: 'USER',
        isActive: true,
        emailVerified: false,
      },
    })

    const emailResult = await sendUserVerificationEmail(user.id)
    if (!emailResult.success) {
      console.error('Failed to send customer verification email:', emailResult.error)
    }

    return NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      redirectTo: `/auth/verify-email?email=${encodeURIComponent(email)}`,
      emailSent: emailResult.success,
    })
  } catch (error: any) {
    console.error('POST /api/auth/register/user error:', error)
    return NextResponse.json({ success: false, error: 'Failed to create account.' }, { status: 500 })
  }
}
