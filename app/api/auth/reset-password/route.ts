/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import crypto from 'crypto'
import { hashPassword } from '@/lib/aes'
import { resetPasswordRateLimit } from '@/lib/rateLimit'
import { clientIp } from '@/lib/origin'

export async function POST(request: NextRequest) {
  try {
    // Distributed abuse guard. Fails open on a Redis outage (matching the other
    // auth limiters) so a legitimate reset is never blocked by infrastructure.
    try {
      const limited = await resetPasswordRateLimit.limit(`reset-password:${clientIp(request)}`)
      if (!limited.success) {
        return NextResponse.json(
          { success: false, error: 'Too many requests. Please try again later.' },
          { status: 429 },
        )
      }
    } catch (limitError) {
      console.warn('Reset-password rate limiter unavailable; allowing request', {
        error: limitError instanceof Error ? limitError.message : 'unknown',
      })
    }

    const body = await request.json()
    const { token, email, password } = body

    if (!token || !email || !password) {
      return NextResponse.json(
        { success: false, error: 'Token, email, and password are required' },
        { status: 400 }
      )
    }

    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex')

    const user = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        resetPasswordToken: hashedToken,
      },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired reset token.' },
        { status: 404 }
      )
    }

    if (!user.resetPasswordTokenExpiry || new Date(user.resetPasswordTokenExpiry) < new Date()) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetPasswordToken: null,
          resetPasswordTokenExpiry: null,
        },
      })

      return NextResponse.json(
        { success: false, error: 'Reset token has expired. Please request a new one.' },
        { status: 400 }
      )
    }

    const hashedPassword = await hashPassword(password)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordTokenExpiry: null,
        updatedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully'
    })
  } catch (error: any) {
    console.error('Reset password error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'An error occurred' },
      { status: 500 }
    )
  }
}
