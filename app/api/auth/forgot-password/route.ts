/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { sendPasswordResetEmail } from '@/actions/email.action'
import { forgotPasswordRateLimit } from '@/lib/rateLimit'

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

    // Server-side throttling of reset-email requests. Fail-open when the
    // rate-limit store is unavailable so password recovery is not blocked
    // during a Redis outage.
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    let allowed = true
    try {
      const rateResult = await forgotPasswordRateLimit.limit(`forgot:${ip}`)
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

    const result = await sendPasswordResetEmail(email)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to send reset email' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent.'
    })
  } catch (error: any) {
    console.error('Forgot password error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'An error occurred' },
      { status: 500 }
    )
  }
}
