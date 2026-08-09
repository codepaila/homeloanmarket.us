import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import prisma from '@/lib/prisma'
import { withBrokerClaimLock } from '@/lib/claim-invitation'
import { adminClaimRevokeRateLimit } from '@/lib/rateLimit'
import { clientIp, isSameOriginRequest } from '@/lib/origin'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const admin = await getCurrentUser()
  if (admin?.role !== 'ADMIN') return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const adminLimit = await adminClaimRevokeRateLimit.limit(`${admin.id}:${clientIp(request)}`)
  if (!adminLimit.success) {
    return NextResponse.json({ message: 'Too many revokes. Try again later.' }, { status: 429 })
  }

  const { id } = await params
  const body = await request.json()
  const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
  if (!reason) return NextResponse.json({ message: 'A revocation reason is required' }, { status: 422 })

  try {
    const existingInvitation = await prisma.brokerClaimInvitation.findUnique({
      where: { id },
      select: { claim: { select: { brokerId: true } } },
    })
    if (!existingInvitation) return NextResponse.json({ message: 'Invitation not found' }, { status: 404 })

    const result = await withBrokerClaimLock(existingInvitation.claim.brokerId, () => prisma.$transaction(async (tx) => {
      const invitation = await tx.brokerClaimInvitation.findUnique({
        where: { id },
        include: { claim: true },
      })
      if (!invitation) throw new Error('NOT_FOUND')
      if (invitation.status !== 'ACTIVE') throw new Error('NOT_ACTIVE')

      await tx.brokerClaimInvitation.update({
        where: { id },
        data: { status: 'REVOKED', revokedAt: new Date() },
      })
      await tx.brokerClaim.update({
        where: { id: invitation.claim.id },
        data: { status: 'REVOKED' },
      })
      await tx.brokerClaimEvent.create({
        data: {
          brokerClaimId: invitation.claim.id,
          invitationId: id,
          actorUserId: admin.id,
          eventType: 'REVOKED',
          metadata: { reason },
        },
      })

      return { id, status: 'REVOKED' as const }
    }))

    return NextResponse.json({ invitation: result })
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return NextResponse.json({ message: 'Invitation not found' }, { status: 404 })
    }
    if (error instanceof Error && error.message === 'NOT_ACTIVE') {
      return NextResponse.json({ message: 'Invitation is no longer active' }, { status: 409 })
    }
    console.error('Admin claim invitation revoke failed', error)
    return NextResponse.json({ message: 'Unable to revoke invitation' }, { status: 500 })
  }
}
