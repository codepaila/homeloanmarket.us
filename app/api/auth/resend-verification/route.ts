/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/auth/resend-verification/route.ts
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { resendBrokerVerificationEmail, sendUserVerificationEmail } from '@/actions/email.action'
import { resendVerificationRateLimit } from '@/lib/rateLimit'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      )
    }

    // Server-side throttling of resend requests. Fail-open when the
    // rate-limit store is unavailable.
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    let allowed = true
    try {
      const rateResult = await resendVerificationRateLimit.limit(`resend:${ip}`)
      allowed = rateResult.success
    } catch {
      // fail open
    }
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    // Find user with broker profile
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        brokerProfile: true
      }
    })

    if (!user) {
      return NextResponse.json(
        { success: true, message: 'If an account exists with this email, a verification link has been sent' },
        { status: 200 }
      )
    }

    // Enumeration-resistant: an already-verified account gets the same generic
    // response as an unknown account (no email is sent).
    if (user.emailVerified) {
      return NextResponse.json(
        { success: true, message: 'If an account exists with this email, a verification link has been sent' },
        { status: 200 }
      )
    }

    if (!user.brokerProfile) {
      const result = await sendUserVerificationEmail(user.id)
      return NextResponse.json({
        success: result.success,
        message: result.success ? 'Verification email sent successfully' : 'Unable to send verification email',
      }, { status: result.success ? 200 : 500 })
    }

    // Resend verification email
    const result = await resendBrokerVerificationEmail(user.brokerProfile.id)

    if (!result.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: result.error || 'Failed to resend verification email' 
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Verification email sent successfully'
    })
  } catch (error: any) {
    console.error('Resend verification error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to resend verification email' 
      },
      { status: 500 }
    )
  }
}
