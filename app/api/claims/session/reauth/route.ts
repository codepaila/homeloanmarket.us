import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { auth } from '@/lib/auth'
import { getClaimContext, setClaimContext } from '@/lib/claim-context'
import { ClaimFlowError, findClaimInvitationByContext } from '@/lib/claim-flow'
import prisma from '@/lib/prisma'
import { claimReauthRateLimit } from '@/lib/rateLimit'
import { clientIp, isSameOriginRequest } from '@/lib/origin'

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ message: 'Reauthentication could not be completed' }, { status: 403 })
  }

  const context = await getClaimContext()
  const session = await auth()
  if (!context || !session?.user?.email) return NextResponse.json({ message: 'Authentication required' }, { status: 401 })

  const rateLimit = await claimReauthRateLimit.limit(`${clientIp(request)}:${context.invitationId}`)
  if (!rateLimit.success) {
    return NextResponse.json({ message: 'Too many attempts. Try again later.' }, { status: 429 })
  }

  const body = await request.json()
  const provider = body.provider === 'google' ? 'google' : 'credentials'

  try {
    await findClaimInvitationByContext(context)
    const user = await prisma.user.findUnique({ where: { email: session.user.email }, include: { accounts: true } })
    if (!user || !user.isActive || user.email?.toLowerCase() !== context.email?.toLowerCase()) throw new ClaimFlowError('INELIGIBLE')

    if (provider === 'google') {
      if (!user.accounts.some((account) => account.provider === 'google')) throw new ClaimFlowError('INELIGIBLE')
    } else {
      if (!user.password || typeof body.password !== 'string' || !(await bcrypt.compare(body.password, user.password))) throw new ClaimFlowError('INELIGIBLE')
    }

    await setClaimContext({ ...context, reauthenticatedAt: Date.now(), reauthenticatedVia: provider })
    return NextResponse.json({ success: true })
  } catch (error) {
    const status = error instanceof ClaimFlowError && error.code === 'EXPIRED' ? 410 : 403
    return NextResponse.json({ message: 'Reauthentication could not be completed' }, { status })
  }
}
