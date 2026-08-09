/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { sendBrokerRegistrationEmails } from '@/actions/email.action'
import { brokerRegisterRateLimit } from '@/lib/rateLimit'
import {
  normalizeBrokerRegistrationInput,
  validateBrokerRegistrationInput,
  createBrokerAccount,
} from '@/lib/broker-registration'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      name,
      companyName,
      email,
      phone,
      password,
      description,
      officeAddress,
      city,
      state,
      pinCode,
      agreeTerms,
      captchaAnswer,
      expectedCaptcha,
    } = body

    const normalized = normalizeBrokerRegistrationInput({
      name: typeof name === 'string' ? name : '',
      companyName: typeof companyName === 'string' ? companyName : undefined,
      email: typeof email === 'string' ? email : '',
      phone: typeof phone === 'string' ? phone : '',
      password: typeof password === 'string' ? password : '',
      description: typeof description === 'string' ? description : '',
      officeAddress: typeof officeAddress === 'string' ? officeAddress : '',
      city: typeof city === 'string' ? city : '',
      state: typeof state === 'string' ? state : '',
      pinCode: typeof pinCode === 'string' ? pinCode : '',
    })

    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    const { success } = await brokerRegisterRateLimit.limit(`broker_register:${ip}`)
    if (!success) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Please try again later.' },
        { status: 429 }
      )
    }

    // CAPTCHA verification
    if (typeof captchaAnswer !== 'number' || captchaAnswer !== expectedCaptcha) {
      return NextResponse.json(
        { error: 'Captcha verification failed' },
        { status: 400 }
      )
    }

    const validationErrors = validateBrokerRegistrationInput(normalized)
    if (agreeTerms !== true) validationErrors.push('Terms agreement is required')
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: validationErrors[0] },
        { status: 400 }
      )
    }

    const { user, broker } = await createBrokerAccount({
      name: normalized.name,
      companyName: normalized.companyName || undefined,
      email: normalized.email,
      phone: normalized.phone,
      password: normalized.password,
      description: normalized.description,
      officeAddress: normalized.officeAddress,
      city: normalized.city,
      state: normalized.state,
      pinCode: normalized.pinCode,
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
        brokerId: broker.id,
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
