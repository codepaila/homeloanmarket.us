import { NextResponse } from 'next/server'
import { hashPassword } from '@/lib/aes'
import { getClaimContext } from '@/lib/claim-context'
import { ClaimFlowError, findClaimInvitationByContext, recordClaimEvent } from '@/lib/claim-flow'
import prisma from '@/lib/prisma'
import { sendClaimVerificationEmail } from '@/actions/email.action'
import { claimSetupRateLimit } from '@/lib/rateLimit'
import { clientIp, isSameOriginRequest } from '@/lib/origin'

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ message: 'Claim account setup cannot continue' }, { status: 403 })
  }

  const context = await getClaimContext()
  if (!context?.email) return NextResponse.json({ message: 'Claim session requires an email' }, { status: 401 })
  const rateLimit = await claimSetupRateLimit.limit(`${clientIp(request)}:${context.invitationId}`)
  if (!rateLimit.success) return NextResponse.json({ message: 'Too many attempts. Try again later.' }, { status: 429 })

  const body = await request.json()
  const password = typeof body.password === 'string' ? body.password : ''
  if (password.length < 8) return NextResponse.json({ message: 'Password must be at least 8 characters long' }, { status: 422 })

  try {
    const invitation = await findClaimInvitationByContext(context)
    const existing = await prisma.user.findUnique({ where: { email: context.email }, select: { id: true } })
    if (existing) return NextResponse.json({ message: 'Use the existing account sign-in option to continue' }, { status: 409 })

    const user = await prisma.user.create({
      data: {
        email: context.email,
        password: await hashPassword(password),
        role: 'BROKER',
        isActive: true,
        emailVerified: false,
      },
    })
    await recordClaimEvent(invitation.claim.id, 'VERIFICATION_PENDING', invitation.id, user.id)
    const email = await sendClaimVerificationEmail(user.id)
    return NextResponse.json({ next: 'VERIFY_EMAIL', emailSent: email.success })
  } catch (error) {
    const status = error instanceof ClaimFlowError && error.code === 'EXPIRED' ? 410 : 409
    return NextResponse.json({ message: 'Claim account setup cannot continue' }, { status })
  }
}
