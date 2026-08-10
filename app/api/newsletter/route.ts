import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'
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
    const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
    const escaped = email.replace(/[&<>"']/g, (character: string) => entities[character] || character)
    const result = await sendEmail({
      to: recipient,
      subject: '[HomeLoanMarket newsletter] New subscriber',
      text: `Newsletter signup: ${email}`,
      html: `<p>Newsletter signup: ${escaped}</p>`,
      idempotencyKey: `newsletter_${email}`,
    })
    if (!result.success) return NextResponse.json({ success: false, error: 'Unable to subscribe right now.' }, { status: 502 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: 'Unable to subscribe right now.' }, { status: 500 })
  }
}
