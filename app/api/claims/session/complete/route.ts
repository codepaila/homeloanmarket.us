import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { clearClaimContext, getClaimContext } from '@/lib/claim-context'
import { ClaimFlowError } from '@/lib/claim-flow'
import { completeClaimForUser } from '@/lib/claim-completion'
import { claimCompleteRateLimit } from '@/lib/rateLimit'
import { clientIp, isSameOriginRequest } from '@/lib/origin'

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ message: 'Claim is no longer available' }, { status: 403 })
  }

  const context = await getClaimContext()
  if (!context) return NextResponse.json({ message: 'Claim session expired' }, { status: 401 })
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ message: 'Authentication required' }, { status: 401 })

  const rateLimit = await claimCompleteRateLimit.limit(`${clientIp(request)}:${context.invitationId}`)
  if (!rateLimit.success) {
    return NextResponse.json({ message: 'Too many attempts. Try again later.' }, { status: 429 })
  }

  try {
    const completed = await completeClaimForUser(context, session.user.id, session.user.email)

    await clearClaimContext()
    return NextResponse.json({ success: true, ...completed, redirectTo: '/broker/dashboard' })
  } catch (error) {
    const status = error instanceof ClaimFlowError && error.code === 'EXPIRED' ? 410 : error instanceof ClaimFlowError ? 409 : 500
    return NextResponse.json({ message: status === 500 ? 'Unable to complete claim' : 'Claim is no longer available' }, { status })
  }
}
