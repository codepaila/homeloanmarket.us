import prisma from '@/lib/prisma'
import { hashClaimToken } from '@/lib/tokens'
import type { ClaimContext } from '@/lib/claim-context'

export class ClaimFlowError extends Error {
  constructor(public code: 'INVALID' | 'EXPIRED' | 'REVOKED' | 'USED' | 'OWNED' | 'INELIGIBLE' | 'CONFLICT' | 'NOT_AUTHENTICATED') {
    super(code)
    this.name = 'ClaimFlowError'
  }
}

async function materializeExpiredInvitation(invitationId: string, claimId: string) {
  await prisma.$transaction(async (tx) => {
    const changed = await tx.brokerClaimInvitation.updateMany({
      where: { id: invitationId, status: 'ACTIVE', expiresAt: { lte: new Date() } },
      data: { status: 'EXPIRED' },
    })
    if (changed.count === 1) {
      await tx.brokerClaim.updateMany({ where: { id: claimId, status: { in: ['INVITED', 'IN_PROGRESS'] } }, data: { status: 'EXPIRED' } })
      await tx.brokerClaimEvent.create({ data: { brokerClaimId: claimId, invitationId, eventType: 'EXPIRED', metadata: { source: 'request-validation' } } })
    }
  })
}

export async function findClaimInvitation(rawToken: string) {
  const invitation = await prisma.brokerClaimInvitation.findUnique({
    where: { tokenHash: hashClaimToken(rawToken) },
    include: {
      claim: {
        include: {
          broker: {
            select: {
              id: true,
              userId: true,
              creationSource: true,
              brokerStatus: true,
              verificationStatus: true,
              isVisible: true,
              displayName: true,
              companyName: true,
              profileSlug: true,
              logo: true,
              description: true,
              city: true,
              state: true,
              officeAddress: true,
              experienceYears: true,
              specializations: true,
              serviceCities: true,
              languages: true,
            },
          },
        },
      },
    },
  })

  if (!invitation) throw new ClaimFlowError('INVALID')
  if (invitation.status === 'REVOKED') throw new ClaimFlowError('REVOKED')
  if (invitation.status === 'USED') throw new ClaimFlowError('USED')
  if (invitation.status === 'EXPIRED') throw new ClaimFlowError('EXPIRED')
  if (invitation.expiresAt <= new Date()) {
    await materializeExpiredInvitation(invitation.id, invitation.claim.id)
    throw new ClaimFlowError('EXPIRED')
  }
  if (invitation.status !== 'ACTIVE') throw new ClaimFlowError('INVALID')
  if (
    invitation.claim.status === 'COMPLETED' ||
    invitation.claim.broker.userId ||
    invitation.claim.broker.creationSource !== 'ADMIN_CREATED' ||
    invitation.claim.broker.brokerStatus === 'SUSPENDED'
  ) throw new ClaimFlowError('OWNED')

  return invitation
}

export async function findClaimInvitationByContext(context: ClaimContext) {
  const invitation = await prisma.brokerClaimInvitation.findUnique({
    where: { id: context.invitationId },
    include: { claim: { include: { broker: true } } },
  })
  if (!invitation || invitation.tokenHash !== context.tokenHash) throw new ClaimFlowError('INVALID')
  if (invitation.status === 'REVOKED') throw new ClaimFlowError('REVOKED')
  if (invitation.status === 'USED') throw new ClaimFlowError('USED')
  if (invitation.status === 'EXPIRED') throw new ClaimFlowError('EXPIRED')
  if (invitation.expiresAt <= new Date()) {
    await materializeExpiredInvitation(invitation.id, invitation.claim.id)
    throw new ClaimFlowError('EXPIRED')
  }
  if (invitation.status !== 'ACTIVE') throw new ClaimFlowError('INVALID')
  if (invitation.claim.status === 'COMPLETED' || invitation.claim.broker.userId) throw new ClaimFlowError('OWNED')
  if (invitation.claim.broker.creationSource !== 'ADMIN_CREATED' || invitation.claim.broker.brokerStatus === 'SUSPENDED') {
    throw new ClaimFlowError('INELIGIBLE')
  }
  return invitation
}

export function safeClaimProfile(broker: Awaited<ReturnType<typeof findClaimInvitation>>['claim']['broker']) {
  return {
    displayName: broker.displayName,
    companyName: broker.companyName,
    profileSlug: broker.profileSlug,
    logo: broker.logo,
    description: broker.description,
    city: broker.city,
    state: broker.state,
    officeAddress: broker.officeAddress,
    experienceYears: broker.experienceYears,
    specializations: broker.specializations,
    serviceCities: broker.serviceCities,
    languages: broker.languages,
  }
}

export async function recordClaimEvent(
  claimId: string,
  eventType: 'STARTED' | 'EMAIL_SUBMITTED' | 'VERIFICATION_PENDING' | 'COMPLETED' | 'EXPIRED' | 'REVOKED' | 'FAILED',
  invitationId?: string,
  actorUserId?: string,
  metadata?: Record<string, string>,
) {
  return prisma.brokerClaimEvent.create({
    data: {
      brokerClaimId: claimId,
      invitationId,
      actorUserId,
      eventType,
      metadata,
    },
  })
}

export function classifyClaimUser(user: {
  role: string
  isActive: boolean
  emailVerified: boolean
  password: string | null
  brokerProfile: { id: string } | null
  accounts: { provider: string }[]
}) {
  if (!user.isActive) return 'INACTIVE'
  if (user.role === 'ADMIN') return 'ADMIN'
  if (user.brokerProfile) return 'BROKER_WITH_PROFILE'
  if (user.role === 'BROKER') return 'BROKER_AVAILABLE'
  if (user.accounts.some((account) => account.provider === 'google') && !user.password) return 'GOOGLE_ONLY'
  return 'EXISTING_USER'
}
