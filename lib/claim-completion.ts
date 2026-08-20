import prisma from '@/lib/prisma'
import type { ClaimContext } from '@/lib/claim-context'
import { ClaimFlowError, findClaimInvitationByContext } from '@/lib/claim-flow'
import { isClaimRecipientMatch } from '@/lib/claim-policy'

export async function completeClaimForUser(context: ClaimContext, userId: string, sessionEmail: string) {
  const invitation = await findClaimInvitationByContext(context)
  if (!context.reauthenticatedAt || context.reauthenticatedAt < Date.now() - 10 * 60 * 1000) throw new ClaimFlowError('INELIGIBLE')
  if (context.email && sessionEmail.toLowerCase() !== context.email.toLowerCase()) throw new ClaimFlowError('INELIGIBLE')

  return prisma.$transaction(async (tx) => {
    const currentInvitation = await tx.brokerClaimInvitation.findUnique({
      where: { id: invitation.id },
      include: { claim: { include: { broker: true } } },
    })
    if (!currentInvitation || currentInvitation.tokenHash !== context.tokenHash) throw new ClaimFlowError('INVALID')
    if (currentInvitation.status === 'REVOKED') throw new ClaimFlowError('REVOKED')
    if (currentInvitation.status === 'USED') throw new ClaimFlowError('USED')
    if (currentInvitation.status !== 'ACTIVE' || currentInvitation.expiresAt <= new Date()) throw new ClaimFlowError('EXPIRED')
    if (currentInvitation.claim.status === 'COMPLETED' || currentInvitation.claim.broker.userId) throw new ClaimFlowError('OWNED')

    // Recipient binding: a claim invitation issued to `recipientEmail` may only
    // be completed by an account whose email matches that intended recipient.
    // The raw link is a bearer credential, so ownership must never transfer to
    // a different account that merely possesses the link.
    if (!isClaimRecipientMatch(currentInvitation.recipientEmail, sessionEmail)) throw new ClaimFlowError('INELIGIBLE')

    const user = await tx.user.findUnique({
      where: { id: userId },
      include: {
        accounts: { select: { provider: true } },
        companyMemberships: { where: { isActive: true }, select: { id: true } },
      },
    })
    if (!user || !user.isActive || user.role === 'ADMIN') throw new ClaimFlowError('INELIGIBLE')
    if (user.companyMemberships.length > 0) throw new ClaimFlowError('INELIGIBLE')

    const googleReauthenticated = context.reauthenticatedVia === 'google' &&
      user.accounts.some((account) => account.provider === 'google')
    if (!user.emailVerified && !googleReauthenticated) throw new ClaimFlowError('INELIGIBLE')
    const existingBroker = await tx.broker.findFirst({ where: { userId }, select: { id: true } })
    if (existingBroker && existingBroker.id !== currentInvitation.claim.brokerId) throw new ClaimFlowError('CONFLICT')

    const attached = await tx.broker.updateMany({ where: { id: currentInvitation.claim.brokerId, userId: null }, data: { userId } })
    if (attached.count !== 1) throw new ClaimFlowError('OWNED')

    await tx.brokerClaim.update({ where: { id: currentInvitation.claim.id }, data: { status: 'COMPLETED', completedAt: new Date(), completedByUserId: userId } })
    await tx.brokerClaimInvitation.update({ where: { id: currentInvitation.id }, data: { status: 'USED', usedAt: new Date() } })
    await tx.brokerClaimEvent.create({
      data: { brokerClaimId: currentInvitation.claim.id, invitationId: currentInvitation.id, actorUserId: userId, eventType: 'COMPLETED', metadata: { ownership: 'attached' } },
    })
    if (user.role !== 'BROKER') await tx.user.update({ where: { id: userId }, data: { role: 'BROKER' } })
    // The claim attaches the User to the existing Broker without touching its
    // BrokerSubscription. Return the broker's current subscription plan so
    // callers never assume a hard-coded plan.
    const broker = await tx.broker.findUnique({
      where: { id: currentInvitation.claim.brokerId },
      select: { subscription: { select: { plan: true } } },
    })
    return { brokerId: currentInvitation.claim.brokerId, profileSlug: currentInvitation.claim.broker.profileSlug, subscriptionPlan: broker?.subscription?.plan || null }
  })
}
