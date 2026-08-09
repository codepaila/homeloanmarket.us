import { NextResponse } from 'next/server'
import { ClaimFlowError, findClaimInvitation, safeClaimProfile } from '@/lib/claim-flow'
import { claimPreviewRateLimit } from '@/lib/rateLimit'
import { clientIp } from '@/lib/origin'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params
    const rateLimit = await claimPreviewRateLimit.limit(`${clientIp(request)}:${token}`)
    if (!rateLimit.success) {
      return NextResponse.json({ message: 'Too many attempts. Try again later.' }, { status: 429 })
    }

    const invitation = await findClaimInvitation(token)
    return NextResponse.json({
      canStart: true,
      claimStatus: invitation.claim.status,
      invitationExpiresAt: invitation.expiresAt,
      profile: safeClaimProfile(invitation.claim.broker),
    })
  } catch (error) {
    const status = error instanceof ClaimFlowError && error.code === 'EXPIRED' ? 410 : 404
    return NextResponse.json({ message: 'This claim invitation is not available' }, { status })
  }
}
