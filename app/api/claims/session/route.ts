import { NextResponse } from 'next/server'
import { getClaimContext } from '@/lib/claim-context'
import { ClaimFlowError, findClaimInvitationByContext, safeClaimProfile } from '@/lib/claim-flow'

export async function GET() {
  const context = await getClaimContext()
  if (!context) return NextResponse.json({ message: 'Claim session expired' }, { status: 401 })
  try {
    const invitation = await findClaimInvitationByContext(context)
    return NextResponse.json({ profile: safeClaimProfile(invitation.claim.broker), claimStatus: invitation.claim.status, email: context.email || null })
  } catch (error) {
    const status = error instanceof ClaimFlowError && error.code === 'EXPIRED' ? 410 : 409
    return NextResponse.json({ message: 'Claim session is no longer available' }, { status })
  }
}
