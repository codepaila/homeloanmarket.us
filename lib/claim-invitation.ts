import crypto from 'crypto'
import { Redis } from '@upstash/redis'
import prisma from '@/lib/prisma'
import { generateClaimToken, hashClaimToken } from '@/lib/tokens'
export { isClaimInvitationActive } from '@/lib/claim-policy'

const CLAIM_INVITATION_DAYS = 7
const redis = Redis.fromEnv()

export class ClaimInvitationError extends Error {
  constructor(public code: 'NOT_FOUND' | 'INELIGIBLE' | 'COMPLETED' | 'LOCKED') {
    super(code)
    this.name = 'ClaimInvitationError'
  }
}

export async function withBrokerClaimLock<T>(brokerId: string, operation: () => Promise<T>) {
  const lockKey = `homeloanmarket:claim-issuance:${brokerId}`
  const lockValue = crypto.randomUUID()
  const acquired = await redis.set(lockKey, lockValue, { nx: true, ex: 15 })

  if (acquired !== 'OK') throw new ClaimInvitationError('LOCKED')

  try {
    return await operation()
  } finally {
    const currentLock = await redis.get<string>(lockKey)
    if (currentLock === lockValue) await redis.del(lockKey)
  }
}

export async function issueBrokerClaimInvitation(brokerId: string, adminId: string, recipientEmail: string) {
  return withBrokerClaimLock(brokerId, async () => {
    const rawToken = generateClaimToken()
    const tokenHash = hashClaimToken(rawToken)
    const expiresAt = new Date(Date.now() + CLAIM_INVITATION_DAYS * 24 * 60 * 60 * 1000)

    const result = await prisma.$transaction(async (tx) => {
      const broker = await tx.broker.findUnique({
        where: { id: brokerId },
        select: { id: true, userId: true, creationSource: true, brokerStatus: true },
      })

      if (!broker) throw new ClaimInvitationError('NOT_FOUND')
      if (broker.userId || broker.creationSource !== 'ADMIN_CREATED' || broker.brokerStatus === 'SUSPENDED') {
        throw new ClaimInvitationError('INELIGIBLE')
      }

      const existingClaim = await tx.brokerClaim.findUnique({ where: { brokerId } })
      if (existingClaim?.status === 'COMPLETED') throw new ClaimInvitationError('COMPLETED')

      const claim = existingClaim
        ? await tx.brokerClaim.update({
            where: { id: existingClaim.id },
            data: { status: 'INVITED', startedAt: null },
          })
        : await tx.brokerClaim.create({
            data: { brokerId, status: 'INVITED' },
          })

      const activeInvitations = await tx.brokerClaimInvitation.findMany({
        where: { brokerClaimId: claim.id, status: 'ACTIVE' },
        select: { id: true },
      })

      await tx.brokerClaimInvitation.updateMany({
        where: { brokerClaimId: claim.id, status: 'ACTIVE' },
        data: { status: 'REVOKED', revokedAt: new Date() },
      })

      for (const previous of activeInvitations) {
        await tx.brokerClaimEvent.create({
          data: {
            brokerClaimId: claim.id,
            invitationId: previous.id,
            actorUserId: adminId,
            eventType: 'REVOKED',
            metadata: { reason: 'SUPERSEDED' },
          },
        })
      }

      const invitation = await tx.brokerClaimInvitation.create({
        data: {
          brokerClaimId: claim.id,
          tokenHash,
          recipientEmail,
          status: 'ACTIVE',
          expiresAt,
          createdById: adminId,
        },
      })

      await tx.brokerClaimEvent.create({
        data: {
          brokerClaimId: claim.id,
          invitationId: invitation.id,
          actorUserId: adminId,
          eventType: 'GENERATED',
          metadata: { expiresAt: expiresAt.toISOString() },
        },
      })

      return { brokerId, claimId: claim.id, invitationId: invitation.id, expiresAt }
    })

    return { ...result, rawToken }
  })
}

export const CLAIM_INVITATION_LIFETIME_DAYS = CLAIM_INVITATION_DAYS
