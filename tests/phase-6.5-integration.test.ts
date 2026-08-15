import assert from 'node:assert/strict'
import test, { after, before } from 'node:test'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { PrismaClient } from '@prisma/client'
import { generateClaimToken, hashClaimToken } from '../lib/tokens'
import { isClaimInvitationActive } from '../lib/claim-policy'

const prisma = new PrismaClient()
const execFileAsync = promisify(execFile)
const suffix = `phase65-${Date.now()}`
const profileIds: string[] = []
const userIds: string[] = []
const claimIds: string[] = []
const invitationIds: string[] = []
let unownedBrokerId: string
type MongoIndex = { name: string; unique?: boolean; partialFilterExpression?: { userId?: { $type?: string } } }

function brokerData(profileSlug: string, userId: string | null = null, source: 'ADMIN_CREATED' | 'SELF_REGISTERED' = 'ADMIN_CREATED') {
  return {
    userId,
    creationSource: source,
    displayName: 'Phase 6.5 Broker',
    companyName: 'Phase 6.5 Home Loans',
    profileSlug,
    description: 'Isolated integration test broker profile.',
    phone: '+15551234567',
    email: `${profileSlug}@example.test`,
    officeAddress: '1 Test Street',
    city: 'Austin',
    state: 'Texas',
    pinCode: '78701',
    verificationStatus: 'UNVERIFIED' as const,
    brokerStatus: 'FREE' as const,
    isVisible: false,
    subscription: {
      create: {
        plan: 'FREE' as const,
        isActive: true,
        startDate: new Date(),
        endDate: null,
        stripeCustomerId: null,
        stripeSubId: null,
      },
    },
  }
}

before(async () => {
  await prisma.$connect()
})

after(async () => {
  if (invitationIds.length) await prisma.brokerClaimEvent.deleteMany({ where: { invitationId: { in: invitationIds } } })
  if (claimIds.length) await prisma.brokerClaimEvent.deleteMany({ where: { brokerClaimId: { in: claimIds } } })
  if (invitationIds.length) await prisma.brokerClaimInvitation.deleteMany({ where: { id: { in: invitationIds } } })
  if (claimIds.length) await prisma.brokerClaim.deleteMany({ where: { id: { in: claimIds } } })
  if (profileIds.length) await prisma.brokerSubscription.deleteMany({ where: { brokerId: { in: profileIds } } })
  if (profileIds.length) await prisma.broker.deleteMany({ where: { id: { in: profileIds } } })
  if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } })
  await prisma.$disconnect()
})

test('admin-created Broker and FREE entitlement commit atomically with no User owner', async () => {
  const broker = await prisma.$transaction((tx) => tx.broker.create({ data: brokerData(`${suffix}-admin`) }))
  profileIds.push(broker.id)
  unownedBrokerId = broker.id
  const persisted = await prisma.broker.findUnique({ where: { id: broker.id }, include: { subscription: true } })
  assert.equal(persisted?.creationSource, 'ADMIN_CREATED')
  assert.equal(persisted?.userId, null)
  assert.equal(persisted?.verificationStatus, 'UNVERIFIED')
  assert.equal(persisted?.isVisible, false)
  assert.equal(persisted?.brokerStatus, 'FREE')
  assert.equal(persisted?.subscription?.plan, 'FREE')
  assert.equal(persisted?.subscription?.isActive, true)
  assert.equal(persisted?.subscription?.endDate, null)
  assert.equal(persisted?.subscription?.stripeCustomerId, null)
  assert.equal(persisted?.subscription?.stripeSubId, null)
  assert.equal(await prisma.user.count(), 0)
})

test('partial ownership index allows multiple unowned Brokers', async () => {
  const second = await prisma.broker.create({ data: brokerData(`${suffix}-second-admin`) })
  const third = await prisma.broker.create({ data: brokerData(`${suffix}-third-admin`) })
  profileIds.push(second.id, third.id)
  assert.equal(second.userId, null)
  assert.equal(third.userId, null)

  const claimant = await prisma.user.create({ data: { email: `${suffix}-claimant@example.test`, phone: `+1557${Date.now().toString().slice(-7)}`, role: 'BROKER', isActive: true, emailVerified: true, password: 'hash' } })
  userIds.push(claimant.id)
  const attached = await prisma.broker.updateMany({ where: { id: third.id, userId: null }, data: { userId: claimant.id } })
  assert.equal(attached.count, 1)
  const afterAttachment = await prisma.broker.create({ data: brokerData(`${suffix}-fourth-admin`) })
  profileIds.push(afterAttachment.id)
  assert.equal(afterAttachment.userId, null)
})

test('partial ownership index still rejects duplicate non-null owners', async () => {
  const user = await prisma.user.create({ data: { email: `${suffix}-owner@example.test`, phone: `+1556${Date.now().toString().slice(-7)}`, role: 'BROKER', isActive: true, emailVerified: true, password: 'hash' } })
  userIds.push(user.id)
  const owned = await prisma.broker.create({ data: brokerData(`${suffix}-owned`, user.id, 'SELF_REGISTERED') })
  profileIds.push(owned.id)
  await assert.rejects(
    prisma.broker.create({ data: brokerData(`${suffix}-duplicate-owner`, user.id, 'SELF_REGISTERED') }),
    /Unique constraint failed.*brokers_userId_key|Unique constraint failed.*brokers_userId_non_null_unique/,
  )
})

test('final ownership index is partial and unique', async () => {
  const result = await execFileAsync('mongosh', [
    '--quiet',
    process.env.DATABASE_URL!,
    '--eval',
    "JSON.stringify(db.getSiblingDB(db.getName()).brokers.getIndexes())",
  ])
  const indexes = JSON.parse(result.stdout) as MongoIndex[]
  const ownership = indexes.find((index) => index.name === 'brokers_userId_non_null_unique')
  assert.ok(ownership)
  assert.equal(ownership.unique, true)
  assert.equal(ownership.partialFilterExpression?.userId?.$type, 'objectId')
  assert.equal(indexes.some((index) => index.name === 'brokers_userId_key'), false)
})

test('subscription failure rolls back the Broker in the isolated database', async () => {
  const slug = `${suffix}-rollback`
  await assert.rejects(prisma.$transaction(async (tx) => {
    const broker = await tx.broker.create({ data: brokerData(slug) })
    await tx.brokerSubscription.create({ data: { brokerId: broker.id, plan: 'FREE', isActive: true } })
    await tx.brokerSubscription.create({ data: { brokerId: broker.id, plan: 'FREE', isActive: true } })
  }))
  assert.equal(await prisma.broker.findUnique({ where: { profileSlug: slug } }), null)
})

test('invitation lifecycle persists one active invitation and preserves unowned Broker', async () => {
  const admin = await prisma.user.create({ data: { email: `${suffix}-admin@example.test`, role: 'ADMIN', isActive: true, emailVerified: true } })
  userIds.push(admin.id)
  const broker = await prisma.broker.findUniqueOrThrow({ where: { id: unownedBrokerId } })
  const claim = await prisma.brokerClaim.create({ data: { brokerId: broker.id, status: 'INVITED' } })
  claimIds.push(claim.id)

  const rawToken = generateClaimToken()
  const first = await prisma.brokerClaimInvitation.create({
    data: { brokerClaimId: claim.id, tokenHash: hashClaimToken(rawToken), recipientEmail: `${suffix}-recipient@example.test`, status: 'ACTIVE', expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), createdById: admin.id },
  })
  invitationIds.push(first.id)
  await prisma.brokerClaimEvent.create({ data: { brokerClaimId: claim.id, invitationId: first.id, actorUserId: admin.id, eventType: 'GENERATED', metadata: { safe: true } } })

  assert.equal(first.tokenHash, hashClaimToken(rawToken))
  assert.equal(first.recipientEmail, `${suffix}-recipient@example.test`)
  assert.notEqual(first.tokenHash, rawToken)
  assert.equal(isClaimInvitationActive(first), true)

  await prisma.brokerClaimInvitation.update({ where: { id: first.id }, data: { status: 'REVOKED', revokedAt: new Date() } })
  await prisma.brokerClaimEvent.create({ data: { brokerClaimId: claim.id, invitationId: first.id, actorUserId: admin.id, eventType: 'REVOKED', metadata: { reason: 'SUPERSEDED' } } })
  const second = await prisma.brokerClaimInvitation.create({
    data: { brokerClaimId: claim.id, tokenHash: hashClaimToken(generateClaimToken()), recipientEmail: `${suffix}-recipient-2@example.test`, status: 'ACTIVE', expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), createdById: admin.id },
  })
  invitationIds.push(second.id)

  const activeCount = await prisma.brokerClaimInvitation.count({ where: { brokerClaimId: claim.id, status: 'ACTIVE' } })
  const finalBroker = await prisma.broker.findUnique({ where: { id: broker.id } })
  assert.equal(activeCount, 1)
  assert.equal(second.recipientEmail, `${suffix}-recipient-2@example.test`)
  assert.equal(finalBroker?.userId, null)
  assert.equal(finalBroker?.id, broker.id)
})

test('expired invitation is not considered active and self-registered Broker has no claim', async () => {
  const user = await prisma.user.create({ data: { email: `${suffix}-self@example.test`, phone: `+1555${Date.now().toString().slice(-7)}`, role: 'BROKER', isActive: true, emailVerified: true, password: 'hash' } })
  userIds.push(user.id)
  const broker = await prisma.broker.create({ data: brokerData(`${suffix}-self`, user.id, 'SELF_REGISTERED') })
  profileIds.push(broker.id)
  const claim = await prisma.brokerClaim.findUnique({ where: { brokerId: broker.id } })
  assert.equal(claim, null)
  const expired = { status: 'ACTIVE' as const, expiresAt: new Date(Date.now() - 1) }
  assert.equal(isClaimInvitationActive(expired), false)
})
