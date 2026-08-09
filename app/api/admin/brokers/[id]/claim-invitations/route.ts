import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import { issueBrokerClaimInvitation, ClaimInvitationError } from '@/lib/claim-invitation'
import { checkEmailRateLimit, adminClaimInvitationRateLimit } from '@/lib/rateLimit'
import { sendBrokerClaimInvitationEmail } from '@/actions/email.action'
import { clientIp, isSameOriginRequest } from '@/lib/origin'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const admin = await getCurrentUser()
  if (admin?.role !== 'ADMIN') return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const adminLimit = await adminClaimInvitationRateLimit.limit(`${admin.id}:${clientIp(request)}`)
  if (!adminLimit.success) {
    return NextResponse.json({ message: 'Too many invitations. Try again later.' }, { status: 429 })
  }

  const { id } = await params
  const body = await request.json()
  const deliveryEmail = typeof body.deliveryEmail === 'string'
    ? body.deliveryEmail.trim().toLowerCase()
    : ''
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(deliveryEmail)
  const emailLimit = checkEmailRateLimit(deliveryEmail, 'claim-invitation')

  if (!validEmail || !emailLimit.allowed) {
    return NextResponse.json(
      { message: emailLimit.message || 'A valid delivery email is required' },
      { status: emailLimit.allowed ? 422 : 429 },
    )
  }

  try {
    const result = await issueBrokerClaimInvitation(id, admin.id, deliveryEmail)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://homeloanmarket.com'
    const claimLink = `${appUrl}/claim-broker/${result.rawToken}`
    const email = await sendBrokerClaimInvitationEmail(
      id,
      deliveryEmail,
      claimLink,
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
      claimLink,
    }, { status: 201 })
  } catch (error) {
    if (error instanceof ClaimInvitationError) {
      const status = error.code === 'LOCKED' ? 429 : error.code === 'NOT_FOUND' ? 404 : 409
      return NextResponse.json({ message: 'Broker is not eligible for an invitation' }, { status })
    }
    console.error('Admin claim invitation creation failed', error)
    return NextResponse.json({ message: 'Unable to create claim invitation' }, { status: 500 })
  }
}
