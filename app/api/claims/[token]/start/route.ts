import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import { setClaimContext } from '@/lib/claim-context'
import { ClaimFlowError, findClaimInvitation, safeClaimProfile } from '@/lib/claim-flow'
import prisma from '@/lib/prisma'
import { claimStartRateLimit } from '@/lib/rateLimit'
import { clientIp, isSameOriginRequest } from '@/lib/origin'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ message: 'This claim invitation cannot be started' }, { status: 403 })
  }

  try {
    const { token } = await params
    const rateLimit = await claimStartRateLimit.limit(`${clientIp(request)}:${token}`)
    if (!rateLimit.success) {
      return NextResponse.json({ message: 'Too many attempts. Try again later.' }, { status: 429 })
    }

    const invitation = await findClaimInvitation(token)
    const currentUser = await getCurrentUser()

    await prisma.$transaction(async (tx) => {
      const claim = await tx.brokerClaim.findUnique({ where: { id: invitation.claim.id } })
      if (!claim || claim.status === 'COMPLETED') throw new ClaimFlowError('OWNED')
      const currentInvitation = await tx.brokerClaimInvitation.findUnique({ where: { id: invitation.id } })
      if (!currentInvitation || currentInvitation.status !== 'ACTIVE' || currentInvitation.expiresAt <= new Date()) throw new ClaimFlowError('EXPIRED')
      if (claim.status !== 'IN_PROGRESS') {
        await tx.brokerClaim.update({ where: { id: claim.id }, data: { status: 'IN_PROGRESS', startedAt: new Date() } })
        await tx.brokerClaimEvent.create({
          data: {
            brokerClaimId: claim.id,
            invitationId: invitation.id,
            actorUserId: currentUser?.id,
            eventType: 'STARTED',
            metadata: { source: 'claim-start' },
          },
        })
      }
    })

    await setClaimContext({
      claimId: invitation.claim.id,
      invitationId: invitation.id,
      tokenHash: invitation.tokenHash,
    })
    return NextResponse.json({ claimSession: 'established', profile: safeClaimProfile(invitation.claim.broker), next: 'EMAIL' })
  } catch (error) {
    const status = error instanceof ClaimFlowError && error.code === 'EXPIRED' ? 410 : 409
    return NextResponse.json({ message: 'This claim invitation cannot be started' }, { status })
  }
}
