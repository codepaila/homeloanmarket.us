// Public site contact form endpoint. Anonymous visitors submit here; the
// shared submission logic lives in lib/contact-submission.ts. Admin reads stay
// on GET /api/admin/contact, which remains ADMIN-protected.
import { NextRequest, NextResponse } from 'next/server'
import { contactBrokerRateLimit } from '@/lib/rateLimit'
import { getClientIP } from '@/lib/advertisements/utils'
import {
  CONTACT_RATE_LIMIT_MESSAGE,
  FRIENDLY_CONTACT_ERROR,
  deliverContactSubmission,
  parseContactSubmission,
  validateContactSubmission,
} from '@/lib/contact-submission'

export async function POST(request: NextRequest) {
  try {
    const rate = await contactBrokerRateLimit.limit(`site-contact:${getClientIP(request.headers)}`)
    if (!rate.success) {
      return NextResponse.json({ success: false, error: CONTACT_RATE_LIMIT_MESSAGE }, { status: 429 })
    }

    const body = await request.json().catch(() => null)
    const payload = parseContactSubmission(body)

    const validationError = validateContactSubmission(payload)
    if (validationError) {
      return NextResponse.json({ success: false, error: validationError }, { status: 400 })
    }

    const result = await deliverContactSubmission(payload)
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status })
    }

    return NextResponse.json({ success: true, message: result.message })
  } catch (error) {
    console.error('Error sending contact message:', error)
    return NextResponse.json({ success: false, error: FRIENDLY_CONTACT_ERROR }, { status: 500 })
  }
}
