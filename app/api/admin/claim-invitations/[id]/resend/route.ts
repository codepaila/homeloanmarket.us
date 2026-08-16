import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import { checkEmailRateLimit, adminClaimResendRateLimit } from '@/lib/rateLimit'
import { issueBrokerClaimInvitation, ClaimInvitationError } from '@/lib/claim-invitation'
import prisma from '@/lib/prisma'
import { sendBrokerClaimInvitationEmail } from '@/actions/email.action'
import { clientIp, isSameOriginRequest } from '@/lib/origin'
import { friendlyClaimErrorMessage } from '@/lib/claim-errors'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const admin = await getCurrentUser()
  if (admin?.role !== 'ADMIN') return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const adminLimit = await adminClaimResendRateLimit.limit(`${admin.id}:${clientIp(request)}`)
  if (!adminLimit.success) {
    return NextResponse.json({ message: 'Too many resends. Try again later.' }, { status: 429 })
  }

  const { id } = await params
  const body = await request.json()
  const suppliedEmail = typeof body.deliveryEmail === 'string'
    ? body.deliveryEmail.trim().toLowerCase()
    : ''

  const invitation = await prisma.brokerClaimInvitation.findUnique({
    where: { id },
    select: { recipientEmail: true, claim: { select: { brokerId: true } } },
  })
  if (!invitation) return NextResponse.json({ message: 'No active invitation is available to resend.', errorCode: 'NOT_FOUND' }, { status: 404 })

  const deliveryEmail = suppliedEmail || invitation.recipientEmail
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(deliveryEmail)
  const emailLimit = checkEmailRateLimit(deliveryEmail, 'claim-invitation-resend')
  if (!validEmail || !emailLimit.allowed) {
    return NextResponse.json(
      { message: emailLimit.message || 'Stored recipient email is invalid; provide a new valid email' },
      { status: emailLimit.allowed ? 422 : 429 },
    )
  }

  try {
    const result = await issueBrokerClaimInvitation(invitation.claim.brokerId, admin.id, deliveryEmail)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://homeloanmarket.com'
    const email = await sendBrokerClaimInvitationEmail(
      result.brokerId,
      deliveryEmail,
      `${appUrl}/claim-broker/${result.rawToken}`,
      result.expiresAt,
      result.invitationId,
    )

    return NextResponse.json({
      invitation: {
        id: result.invitationId,
        claimId: result.claimId,
        status: 'ACTIVE',
        expiresAt: result.expiresAt,
        emailSent: email.success,
      },
      claimLink: `${appUrl}/claim-broker/${result.rawToken}`,
    }, { status: 201 })
  } catch (error) {
    if (error instanceof ClaimInvitationError) {
      const status = error.code === 'LOCKED' ? 429 : error.code === 'NOT_FOUND' ? 404 : 409
      return NextResponse.json({ message: friendlyClaimErrorMessage(error.code), errorCode: error.code }, { status })
    }
    console.error('Admin claim invitation resend failed', error)
    return NextResponse.json({ message: 'Unable to resend the invitation. Please try again.', errorCode: 'UNEXPECTED_ERROR' }, { status: 500 })
  }
}
