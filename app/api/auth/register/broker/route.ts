/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { sendBrokerRegistrationEmails } from '@/actions/email.action'
import { brokerRegisterRateLimit, brokerRegisterEmailRateLimit } from '@/lib/rateLimit'
import { isSameOriginRequest } from '@/lib/origin'
import {
  normalizeBrokerAccountRegistrationInput,
  validateBrokerAccountRegistrationInput,
  createBrokerRegistration,
} from '@/lib/broker-registration'

export async function POST(request: NextRequest) {
  try {
    // Defense-in-depth origin check for the browser registration flow. It is
    // NOT the security boundary; the distributed limiters below are.
    if (!isSameOriginRequest(request)) {
      return NextResponse.json(
        { success: false, error: 'Invalid request origin' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, email, password, agreeToTerms, agreeToPrivacy } = body

    const normalized = normalizeBrokerAccountRegistrationInput({
      name: typeof name === 'string' ? name : '',
      email: typeof email === 'string' ? email : '',
      password: typeof password === 'string' ? password : '',
    })

    // Distributed abuse protection (server-enforced). The signup arithmetic
    // CAPTCHA is a CLIENT-SIDE UX friction only and is intentionally not
    // verified here — it is never a security boundary.
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    const { success } = await brokerRegisterRateLimit.limit(`broker_register:${ip}`)
    if (!success) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Please try again later.' },
        { status: 429 }
      )
    }
    if (normalized.email) {
      const emailLimit = await brokerRegisterEmailRateLimit.limit(`broker_register_email:${normalized.email}`)
      if (!emailLimit.success) {
        return NextResponse.json(
          { error: 'Too many registration attempts. Please try again later.' },
          { status: 429 }
        )
      }
    }

    // Legal consent verification (server-authoritative — must not be bypassed)
    if (agreeToTerms !== true || agreeToPrivacy !== true) {
      return NextResponse.json(
        { error: 'You must agree to both the Terms & Conditions and Privacy Policy.', status: 400 }
      )
    }

    const validationErrors = validateBrokerAccountRegistrationInput(normalized)
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: validationErrors[0] },
        { status: 400 }
      )
    }

    const { user, registration } = await createBrokerRegistration({
      name: normalized.name,
      email: normalized.email,
      password: normalized.password,
    })

    // Send registration emails (verification + admin notification)
    const emailResult = await sendBrokerRegistrationEmails(user.id)

    if (!emailResult.success) {
      console.error('Failed to send registration emails:', emailResult.error)
    }

    // Generate session token for immediate login (optional)
    // const sessionToken = crypto.randomBytes(32).toString('hex')

    return NextResponse.json({
      success: true,
      message: 'Your broker account has been created. Please check your email to verify your account.',
      data: {
        id: user.id,
        registrationId: registration.id,
        name: user.name,
        email: user.email,
        role: user.role,
        redirectTo: `/auth/verify-email?email=${encodeURIComponent(normalized.email)}`,
        emailSent: emailResult.success,
      }
    })
  } catch (error: any) {
    if (error?.name === 'DuplicateAccountError') {
      return NextResponse.json(
        { success: false, error: 'An account with these details already exists.' },
        { status: 409 }
      )
    }
    console.error('Broker registration error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to create broker account' 
      },
      { status: 500 }
    )
  }
}
