import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, emailTemplates, isValidEmail } from '@/lib/email'
import { contactBrokerRateLimit } from '@/lib/rateLimit'
import { platformConfig } from '@/lib/platform-config'
import { getClientIP } from '@/lib/advertisements/utils'

// RFC 5321 upper bound for an email address. Enforced before any provider call.
const NEWSLETTER_EMAIL_MAX_LENGTH = 254

export async function POST(request: NextRequest) {
  try {
    const limit = await contactBrokerRateLimit.limit(`newsletter:${getClientIP(request.headers)}`)
    if (!limit.success) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429 },
      )
    }

    const body = await request.json().catch(() => null)
    const email = body && typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!email || email.length > NEWSLETTER_EMAIL_MAX_LENGTH || !isValidEmail(email)) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid email address.' },
        { status: 400 },
      )
    }

    const recipient = platformConfig.adminEmails.length > 0 ? platformConfig.adminEmails : null
    if (!recipient) {
      console.error('Newsletter signup failed: no admin recipients configured (ADMIN_EMAILS).')
      return NextResponse.json(
        { success: false, error: 'We couldn\u2019t subscribe you right now. Please try again.' },
        { status: 503 },
      )
    }

    const template = emailTemplates.notification({
      title: 'Newsletter signup',
      message: 'A new visitor subscribed to the HomeLoanMarket newsletter.',
      info: { Email: email },
    })
    const result = await sendEmail({
      to: recipient,
      subject: template.subject,
      html: template.html,
      text: `Newsletter signup: ${email}`,
      idempotencyKey: `newsletter_${email}`,
    })

    if (!result.success) {
      console.error('Newsletter signup email failed:', result.errorCode, result.error)
      return NextResponse.json(
        { success: false, error: 'We couldn\u2019t subscribe you right now. Please try again.' },
        { status: 502 },
      )
    }

    // The existing in-memory idempotency guard returns `skipped` when the same
    // normalized email is submitted again inside the dedupe window. Surface
    // that as a friendly, idempotent success instead of a duplicate send.
    const alreadySubscribed = 'skipped' in result && result.skipped === true
    return NextResponse.json({
      success: true,
      message: alreadySubscribed
        ? 'You\u2019re already subscribed.'
        : 'Subscribed successfully.',
    })
  } catch (error) {
    console.error('Newsletter signup failed:', error)
    return NextResponse.json(
      { success: false, error: 'We couldn\u2019t subscribe you right now. Please try again.' },
      { status: 500 },
    )
  }
}
