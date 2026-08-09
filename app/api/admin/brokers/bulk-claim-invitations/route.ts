/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import { issueBrokerClaimInvitation, ClaimInvitationError } from '@/lib/claim-invitation'
import { checkEmailRateLimit } from '@/lib/rateLimit'
import { sendBrokerClaimInvitationEmail } from '@/actions/email.action'
import { isSameOriginRequest } from '@/lib/origin'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const admin = await getCurrentUser()
  if (admin?.role !== 'ADMIN') return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const items = Array.isArray(body.items) ? body.items : []
  if (items.length === 0 || items.length > 50) {
    return NextResponse.json({ message: 'Provide between 1 and 50 invitation items' }, { status: 422 })
  }

  const batchLimit = checkEmailRateLimit(admin.email || admin.id, 'claim-invitation-bulk')
  if (!batchLimit.allowed) return NextResponse.json({ message: batchLimit.message }, { status: 429 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://homeloanmarket.com'
  const results = await Promise.all(items.map(async (item: any) => {
    const brokerId = typeof item?.brokerId === 'string' ? item.brokerId : ''
    const recipientEmail = typeof item?.recipientEmail === 'string' ? item.recipientEmail.trim().toLowerCase() : ''
    if (!brokerId || !EMAIL_PATTERN.test(recipientEmail)) {
      return { brokerId, status: 'FAILED', code: 'INVALID_EMAIL' }
    }

    const emailLimit = checkEmailRateLimit(recipientEmail, 'claim-invitation-bulk-recipient')
    if (!emailLimit.allowed) return { brokerId, status: 'FAILED', code: 'RATE_LIMITED' }

    try {
      const result = await issueBrokerClaimInvitation(brokerId, admin.id, recipientEmail)
      const email = await sendBrokerClaimInvitationEmail(
        brokerId,
        recipientEmail,
        `${appUrl}/claim-broker/${result.rawToken}`,
        result.expiresAt,
        result.invitationId,
      )
      return {
        brokerId,
        invitationId: result.invitationId,
        expiresAt: result.expiresAt,
        status: email.success ? 'SENT' : 'FAILED',
        ...(email.success ? {} : { code: 'EMAIL_DELIVERY_FAILED' }),
      }
    } catch (error) {
      if (error instanceof ClaimInvitationError) {
        return { brokerId, status: 'FAILED', code: error.code }
      }
      console.error('Bulk claim invitation item failed', { brokerId, error })
      return { brokerId, status: 'FAILED', code: 'UNEXPECTED_ERROR' }
    }
  }))

  return NextResponse.json({ results }, { status: 200 })
}
