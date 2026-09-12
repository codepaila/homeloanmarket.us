import { NextResponse } from 'next/server'
import { getClaimContext } from '@/lib/claim-context'
import { ClaimFlowError, findClaimInvitationByContext, safeClaimProfile } from '@/lib/claim-flow'
import { isClaimRecipientMatch } from '@/lib/claim-policy'
import prisma from '@/lib/prisma'

export async function GET() {
  const context = await getClaimContext()
  if (!context) return NextResponse.json({ message: 'Claim session expired' }, { status: 401 })
  try {
    const invitation = await findClaimInvitationByContext(context)

    // Claim-aware account state for the INVITED email only. `context.email` is
    // set exclusively by the email step, which binds it to the invitation
    // recipient; we re-check that binding here so this lookup can never be used
    // to probe an arbitrary address. The signed claim context + invited
    // recipient therefore authorize the result, and it is returned only for a
    // still-claimable ADMIN_CREATED invitation (findClaimInvitationByContext).
    let accountState: 'none' | 'verified' | 'unverified' = 'none'
    const invitedEmail = context.email?.trim().toLowerCase() || ''
    if (invitedEmail && isClaimRecipientMatch(invitation.recipientEmail, invitedEmail)) {
      const existing = await prisma.user.findUnique({
        where: { email: invitedEmail },
        select: { emailVerified: true },
      })
      if (existing) accountState = existing.emailVerified ? 'verified' : 'unverified'
    }

    return NextResponse.json({
      profile: safeClaimProfile(invitation.claim.broker),
      claimStatus: invitation.claim.status,
      email: context.email || null,
      accountState,
    })
  } catch (error) {
    const status = error instanceof ClaimFlowError && error.code === 'EXPIRED' ? 410 : 409
    return NextResponse.json({ message: 'Claim session is no longer available' }, { status })
  }
}
