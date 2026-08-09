import { NextResponse } from 'next/server'
import { getClaimContext, setClaimContext } from '@/lib/claim-context'
import { ClaimFlowError, findClaimInvitationByContext, recordClaimEvent } from '@/lib/claim-flow'
import { isClaimRecipientMatch } from '@/lib/claim-policy'
import { hashClaimToken } from '@/lib/tokens'
import { checkEmailRateLimit, claimEmailSubmissionRateLimit } from '@/lib/rateLimit'
import { clientIp, isSameOriginRequest } from '@/lib/origin'

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ message: 'Claim cannot continue with this invitation' }, { status: 403 })
  }

  const context = await getClaimContext()
  if (!context) return NextResponse.json({ message: 'Claim session expired' }, { status: 401 })

  const distributedLimit = await claimEmailSubmissionRateLimit.limit(`${clientIp(request)}:${context.invitationId}`)
  if (!distributedLimit.success) {
    return NextResponse.json({ message: 'Too many attempts. Try again later.' }, { status: 429 })
  }

  const body = await request.json()
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ message: 'Valid email is required' }, { status: 422 })
  const rateLimit = checkEmailRateLimit(email, 'claim-email-submission')
  if (!rateLimit.allowed) return NextResponse.json({ message: rateLimit.message || 'Too many attempts' }, { status: 429 })

  try {
    const invitation = await findClaimInvitationByContext(context)
    // Recipient binding: the claim session may only proceed with the exact
    // email the invitation was issued to. A forwarded/leaked link cannot bind
    // a different account to the broker. The generic message never reveals the
    // intended recipient's address.
    if (!isClaimRecipientMatch(invitation.recipientEmail, email)) throw new ClaimFlowError('INELIGIBLE')
    await setClaimContext({ ...context, email })
    await recordClaimEvent(invitation.claim.id, 'EMAIL_SUBMITTED', invitation.id, undefined, { emailHash: hashClaimToken(email) })
    return NextResponse.json({ next: 'ACCOUNT_SETUP_OR_REAUTHENTICATION', claimStatus: invitation.claim.status })
  } catch (error) {
    const status = error instanceof ClaimFlowError && error.code === 'EXPIRED' ? 410 : 409
    return NextResponse.json({ message: 'Claim cannot continue with this invitation' }, { status })
  }
}
