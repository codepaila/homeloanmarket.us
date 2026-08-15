import assert from 'node:assert/strict'
import test, { after, before } from 'node:test'
import { PrismaClient } from '@prisma/client'
import { completeClaimForUser } from '../lib/claim-completion'
import { generateClaimToken, hashClaimToken } from '../lib/tokens'

const prisma = new PrismaClient()
const suffix = `phase7-${Date.now()}`
const userIds: string[] = []
const brokerIds: string[] = []
const claimIds: string[] = []
const invitationIds: string[] = []

before(async () => prisma.$connect())
after(async () => {
  if (invitationIds.length) await prisma.brokerClaimEvent.deleteMany({ where: { invitationId: { in: invitationIds } } })
  if (claimIds.length) await prisma.brokerClaimEvent.deleteMany({ where: { brokerClaimId: { in: claimIds } } })
  if (invitationIds.length) await prisma.brokerClaimInvitation.deleteMany({ where: { id: { in: invitationIds } } })
  if (claimIds.length) await prisma.brokerClaim.deleteMany({ where: { id: { in: claimIds } } })
  if (brokerIds.length) await prisma.brokerSubscription.deleteMany({ where: { brokerId: { in: brokerIds } } })
  if (brokerIds.length) await prisma.broker.deleteMany({ where: { id: { in: brokerIds } } })
  if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } })
  await prisma.$disconnect()
})

test('claim completion attaches existing Broker atomically and preserves profile/subscription', async () => {
  const user = await prisma.user.create({ data: { email: `${suffix}@example.test`, phone: `+1558${Date.now().toString().slice(-7)}`, role: 'USER', isActive: true, emailVerified: true, password: 'hash' } })
  userIds.push(user.id)
  const broker = await prisma.broker.create({
    data: {
      userId: null,
      creationSource: 'ADMIN_CREATED',
      displayName: 'Claim Target',
      companyName: 'Claim Target Loans',
      profileSlug: `${suffix}-target`,
      description: 'Existing profile to claim.',
      phone: '+15551234567',
      email: 'company@example.test',
      officeAddress: '1 Main Street',
      city: 'Austin',
      state: 'Texas',
      pinCode: '78701',
      verificationStatus: 'UNVERIFIED',
      brokerStatus: 'FREE',
      isVisible: false,
      subscription: { create: { plan: 'FREE', isActive: true, startDate: new Date(), endDate: null } },
    },
    include: { subscription: true },
  })
  brokerIds.push(broker.id)
  const claim = await prisma.brokerClaim.create({ data: { brokerId: broker.id, status: 'IN_PROGRESS' } })
  claimIds.push(claim.id)
  const rawToken = generateClaimToken()
  const invitation = await prisma.brokerClaimInvitation.create({
    data: {
      brokerClaimId: claim.id,
      tokenHash: hashClaimToken(rawToken),
      recipientEmail: user.email!,
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdById: user.id,
    },
  })
  invitationIds.push(invitation.id)

  const context = { claimId: claim.id, invitationId: invitation.id, tokenHash: invitation.tokenHash, expiresAt: Date.now() + 30 * 60 * 1000, email: user.email!, reauthenticatedAt: Date.now() }
  const result = await completeClaimForUser(context, user.id, user.email!)
  const persisted = await prisma.broker.findUnique({ where: { id: broker.id }, include: { subscription: true } })
  const persistedClaim = await prisma.brokerClaim.findUnique({ where: { id: claim.id } })
  const persistedInvitation = await prisma.brokerClaimInvitation.findUnique({ where: { id: invitation.id } })

  assert.equal(result.brokerId, broker.id)
  assert.equal(persisted?.id, broker.id)
  assert.equal(persisted?.profileSlug, broker.profileSlug)
  assert.equal(persisted?.userId, user.id)
  assert.equal(persisted?.verificationStatus, 'UNVERIFIED')
  assert.equal(persisted?.subscription?.plan, 'FREE')
  assert.equal(persisted?.subscription?.isActive, true)
  assert.equal(persistedClaim?.status, 'COMPLETED')
  assert.equal(persistedInvitation?.status, 'USED')
  assert.equal(await prisma.brokerClaimEvent.count({ where: { brokerClaimId: claim.id, eventType: 'COMPLETED' } }), 1)
  await assert.rejects(completeClaimForUser(context, user.id, user.email!), /USED|INVALID|OWNED/)
})

test('two claimants race with exactly one ownership winner', async () => {
  const users = await Promise.all([1, 2].map((index) => prisma.user.create({
    data: { email: `${suffix}-race-${index}@example.test`, phone: `+1559${Date.now().toString().slice(-6)}${index}`, role: 'USER', isActive: true, emailVerified: true, password: 'hash' },
  })))
  userIds.push(...users.map((user) => user.id))
  const broker = await prisma.broker.create({
    data: {
      userId: null, creationSource: 'ADMIN_CREATED', displayName: 'Race Target', companyName: 'Race Target Loans', profileSlug: `${suffix}-race`, description: 'Race target.', phone: '+15551230000', email: 'race@example.test', officeAddress: '1 Race Street', city: 'Austin', state: 'Texas', pinCode: '78701', verificationStatus: 'UNVERIFIED', brokerStatus: 'FREE', isVisible: false, subscription: { create: { plan: 'FREE', isActive: true, startDate: new Date(), endDate: null } },
    },
  })
  brokerIds.push(broker.id)
  const claim = await prisma.brokerClaim.create({ data: { brokerId: broker.id, status: 'IN_PROGRESS' } })
  claimIds.push(claim.id)
  const invitation = await prisma.brokerClaimInvitation.create({
    data: { brokerClaimId: claim.id, tokenHash: hashClaimToken(generateClaimToken()), recipientEmail: users[0].email!, status: 'ACTIVE', expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), createdById: users[0].id },
  })
  invitationIds.push(invitation.id)
  const contexts = users.map(() => ({ claimId: claim.id, invitationId: invitation.id, tokenHash: invitation.tokenHash, expiresAt: Date.now() + 30 * 60 * 1000, reauthenticatedAt: Date.now() }))
  const results = await Promise.allSettled(users.map((user, index) => completeClaimForUser({ ...contexts[index], email: user.email! }, user.id, user.email!)))
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1)
  const persisted = await prisma.broker.findUnique({ where: { id: broker.id } })
  assert.ok(persisted?.userId === users[0].id || persisted?.userId === users[1].id)
})
