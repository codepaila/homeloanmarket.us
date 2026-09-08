import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, emailTemplates } from '@/lib/email'
import { contactBrokerRateLimit } from '@/lib/rateLimit'

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const limit = await contactBrokerRateLimit.limit(`newsletter:${ip}`)
    if (!limit.success) return NextResponse.json({ success: false, error: 'Too many requests. Please try again later.' }, { status: 429 })

    const body = await request.json()
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ success: false, error: 'Enter a valid email address.' }, { status: 400 })
    }

    const recipient = process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_CONTACT_EMAIL
    if (!recipient) return NextResponse.json({ success: false, error: 'Newsletter service is not configured.' }, { status: 503 })
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
    if (!result.success) return NextResponse.json({ success: false, error: 'Unable to subscribe right now.' }, { status: 502 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: 'Unable to subscribe right now.' }, { status: 500 })
  }
}
