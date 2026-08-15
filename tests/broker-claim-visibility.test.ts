import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { isPublicBroker } from '@/lib/broker-policy'

const completion = fs.readFileSync('lib/claim-completion.ts', 'utf8')
const flow = fs.readFileSync('lib/claim-flow.ts', 'utf8')

test('claim completion never mutates verification, visibility, or location', () => {
  assert.doesNotMatch(completion, /verificationStatus/)
  assert.doesNotMatch(completion, /isVisible/)
  assert.doesNotMatch(completion, /location:/)
  assert.doesNotMatch(completion, /creationSource/)
  assert.match(completion, /broker\.updateMany\(\{ where: \{ id: currentInvitation\.claim\.brokerId, userId: null \}, data: \{ userId \} \}/)
})

test('claim eligibility requires an unowned ADMIN_CREATED, non-suspended broker', () => {
  assert.match(flow, /creationSource !== 'ADMIN_CREATED'/)
  assert.match(flow, /brokerStatus === 'SUSPENDED'/)
  assert.match(flow, /broker\.userId/)
})

test('claimed VERIFIED admin broker remains publicly eligible end-to-end', { skip: !process.env.CLAIM_AUDIT_DATABASE_URL }, async () => {
  process.env.DATABASE_URL = process.env.CLAIM_AUDIT_DATABASE_URL!
  const { PrismaClient } = await import('@prisma/client')
  const prisma = new PrismaClient()
  const { completeClaimForUser } = await import('../lib/claim-completion')
  const { hashClaimToken } = await import('../lib/tokens')
  const suffix = `claim-vis-${Date.now()}`
  try {
    const user = await prisma.user.create({ data: { email: `${suffix}@example.test`, phone: `+1557${Date.now().toString().slice(-7)}`, role: 'USER', isActive: true, emailVerified: true, password: 'hash' } })
    const broker = await prisma.broker.create({
      data: {
        userId: null, creationSource: 'ADMIN_CREATED', displayName: 'Visible Claim Target', companyName: 'Visible Claim Loans', profileSlug: `${suffix}`, description: 'x', phone: '+15551230000', email: 'v@example.test', officeAddress: '1 Main Street', city: 'Houston', state: 'TX', pinCode: '77009', verificationStatus: 'VERIFIED', verifiedAt: new Date(), brokerStatus: 'FREE', isVisible: true, location: { type: 'Point', coordinates: [-95.3698, 29.7604] }, subscription: { create: { plan: 'FREE', isActive: true, startDate: new Date(), endDate: null } },
      },
    })
    const claim = await prisma.brokerClaim.create({ data: { brokerId: broker.id, status: 'IN_PROGRESS' } })
    const invitation = await prisma.brokerClaimInvitation.create({ data: { brokerClaimId: claim.id, tokenHash: hashClaimToken('claim-vis-token'), recipientEmail: user.email!, status: 'ACTIVE', expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), createdById: user.id } })

    await completeClaimForUser({ claimId: claim.id, invitationId: invitation.id, tokenHash: invitation.tokenHash, expiresAt: Date.now() + 30 * 60 * 1000, email: user.email!, reauthenticatedAt: Date.now() }, user.id, user.email!)

    const persisted = await prisma.broker.findUnique({ where: { id: broker.id }, include: { user: { select: { isActive: true } } } })
    assert.ok(persisted)
    assert.equal(persisted.userId, user.id)
    assert.equal(persisted.creationSource, 'ADMIN_CREATED')
    assert.equal(persisted.verificationStatus, 'VERIFIED')
    assert.equal(persisted.isVisible, true)
    assert.deepEqual(persisted.location, { type: 'Point', coordinates: [-95.3698, 29.7604] })
    assert.equal(isPublicBroker({ isVisible: persisted.isVisible, verificationStatus: persisted.verificationStatus, brokerStatus: persisted.brokerStatus, userId: persisted.userId, userIsActive: persisted.user?.isActive }), true)

    await prisma.brokerClaimEvent.deleteMany({ where: { brokerClaimId: claim.id } })
    await prisma.brokerClaimInvitation.deleteMany({ where: { id: invitation.id } })
    await prisma.brokerClaim.deleteMany({ where: { id: claim.id } })
    await prisma.brokerSubscription.deleteMany({ where: { brokerId: broker.id } })
    await prisma.broker.deleteMany({ where: { id: broker.id } })
    await prisma.user.deleteMany({ where: { id: user.id } })
  } finally {
    await prisma.$disconnect()
  }
})
