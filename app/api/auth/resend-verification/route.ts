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
        { success: false, error: 'Please wait before requesting another verification email.', errorCode: 'RATE_LIMITED' },
        { status: 429 }
      )
    }

    // Find user with broker profile
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        brokerProfile: { take: 1 }
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

    // A newly registered broker has a User + BrokerRegistration but no Broker
    // profile until subscription and onboarding. Resend still works without a
    // profile; we never create a fake Broker just to send the verification email.
    if (!user.brokerProfile[0]) {
      const result = await sendUserVerificationEmail(user.id)
      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error: 'Unable to send verification email',
            errorCode: 'EMAIL_SEND_FAILED',
          },
          { status: 500 }
        )
      }
      return NextResponse.json({ success: true, message: 'Verification email sent successfully' })
    }

    // Resend verification email
    const result = await resendBrokerVerificationEmail(user.brokerProfile[0].id)

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unable to send verification email',
          errorCode: 'EMAIL_SEND_FAILED',
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
