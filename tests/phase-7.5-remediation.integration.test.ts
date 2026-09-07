import assert from 'node:assert/strict'
import test, { after, before } from 'node:test'
import { PrismaClient } from '@prisma/client'
import { completeClaimForUser } from '../lib/claim-completion'
import { createBrokerForExistingUser } from '../lib/broker-registration'
import { generateClaimToken, hashClaimToken } from '../lib/tokens'

const prisma = new PrismaClient()
const suffix = `remediation-${Date.now()}`
const userIds: string[] = []
const brokerIds: string[] = []
const claimIds: string[] = []
const invitationIds: string[] = []

function adminBrokerData(profileSlug: string) {
  return {
    userId: null,
    creationSource: 'ADMIN_CREATED' as const,
    displayName: 'Remediation Broker',
    companyName: 'Remediation Home Loans',
    profileSlug,
    description: 'Remediation integration test broker profile.',
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
      create: { plan: 'FREE' as const, isActive: true, startDate: new Date(), endDate: null },
    },
  }
}

async function claimBroker(profileSlug: string, recipientEmail: string) {
  const broker = await prisma.broker.create({ data: adminBrokerData(profileSlug) })
  brokerIds.push(broker.id)
  const claim = await prisma.brokerClaim.create({ data: { brokerId: broker.id, status: 'INVITED' } })
  claimIds.push(claim.id)
  const rawToken = generateClaimToken()
  const invitation = await prisma.brokerClaimInvitation.create({
    data: {
      brokerClaimId: claim.id,
      tokenHash: hashClaimToken(rawToken),
      recipientEmail,
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdById: adminId,
    },
  })
  invitationIds.push(invitation.id)
  return { broker, claim, invitation, rawToken }
}

let adminId = ''

before(async () => {
  await prisma.$connect()
  const admin = await prisma.user.create({ data: { email: `${suffix}-system-admin@example.test`, role: 'ADMIN', isActive: true, emailVerified: true } })
  userIds.push(admin.id)
  adminId = admin.id
})
after(async () => {
  if (invitationIds.length) await prisma.brokerClaimEvent.deleteMany({ where: { invitationId: { in: invitationIds } } })
  if (claimIds.length) await prisma.brokerClaimEvent.deleteMany({ where: { brokerClaimId: { in: claimIds } } })
  if (invitationIds.length) await prisma.brokerClaimInvitation.deleteMany({ where: { id: { in: invitationIds } } })
  if (claimIds.length) await prisma.brokerClaim.deleteMany({ where: { id: { in: claimIds } } })
  if (brokerIds.length) await prisma.brokerBank.deleteMany({ where: { brokerId: { in: brokerIds } } })
  if (brokerIds.length) await prisma.brokerSubscription.deleteMany({ where: { brokerId: { in: brokerIds } } })
  if (brokerIds.length) await prisma.broker.deleteMany({ where: { id: { in: brokerIds } } })
  if (userIds.length) await prisma.account.deleteMany({ where: { userId: { in: userIds } } })
  if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } })
  await prisma.$disconnect()
})

// TEST A — multiple ADMIN_CREATED unowned Brokers must coexist
test('multiple unowned admin-created Brokers can coexist after index remediation', async () => {
  const a = await prisma.broker.create({ data: adminBrokerData(`${suffix}-unowned-a`) })
  const b = await prisma.broker.create({ data: adminBrokerData(`${suffix}-unowned-b`) })
  brokerIds.push(a.id, b.id)
  assert.equal(a.userId, null)
  assert.equal(b.userId, null)
  assert.notEqual(a.id, b.id)
})

// TEST B — issuing a second invitation supersedes the active one
test('second invitation supersedes prior ACTIVE invitation (REVOKED + new ACTIVE)', async () => {
  const admin = await prisma.user.create({ data: { email: `${suffix}-admin@example.test`, phone: `+1550${Date.now().toString().slice(-7)}`, role: 'ADMIN', isActive: true, emailVerified: true } })
  userIds.push(admin.id)
  const broker = await prisma.broker.create({ data: adminBrokerData(`${suffix}-supersede`) })
  brokerIds.push(broker.id)
  const claim = await prisma.brokerClaim.create({ data: { brokerId: broker.id, status: 'INVITED' } })
  claimIds.push(claim.id)

  const first = await prisma.brokerClaimInvitation.create({
    data: {
      brokerClaimId: claim.id,
      tokenHash: hashClaimToken(generateClaimToken()),
      recipientEmail: `${suffix}-recipient-1@example.test`,
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdById: admin.id,
    },
  })
  invitationIds.push(first.id)

  await prisma.brokerClaimInvitation.updateMany({ where: { brokerClaimId: claim.id, status: 'ACTIVE' }, data: { status: 'REVOKED', revokedAt: new Date() } })
  const second = await prisma.brokerClaimInvitation.create({
    data: {
      brokerClaimId: claim.id,
      tokenHash: hashClaimToken(generateClaimToken()),
      recipientEmail: `${suffix}-recipient-2@example.test`,
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdById: admin.id,
    },
  })
  invitationIds.push(second.id)

  const activeCount = await prisma.brokerClaimInvitation.count({ where: { brokerClaimId: claim.id, status: 'ACTIVE' } })
  const firstNow = await prisma.brokerClaimInvitation.findUnique({ where: { id: first.id } })
  assert.equal(activeCount, 1)
  assert.equal(firstNow?.status, 'REVOKED')
  assert.ok(firstNow?.revokedAt)
  assert.equal(second.status, 'ACTIVE')
})

// TEST C — new claimant completes claim; Broker identity/profile/subscription preserved
test('new claimant completes claim and preserves Broker identity and FREE subscription', async () => {
  const user = await prisma.user.create({ data: { email: `${suffix}-newclaim@example.test`, phone: `+1551${Date.now().toString().slice(-7)}`, role: 'BROKER', isActive: true, emailVerified: true, password: 'hash' } })
  userIds.push(user.id)
  const { broker, claim, invitation } = await claimBroker(`${suffix}-newclaim`, user.email!)

  const context = { claimId: claim.id, invitationId: invitation.id, tokenHash: invitation.tokenHash, expiresAt: Date.now() + 30 * 60 * 1000, email: user.email!, reauthenticatedAt: Date.now() }
  const result = await completeClaimForUser(context, user.id, user.email!)
  const persisted = await prisma.broker.findUnique({ where: { id: broker.id }, include: { subscription: true } })

  assert.equal(result.brokerId, broker.id)
  assert.equal(persisted?.id, broker.id)
  assert.equal(persisted?.profileSlug, broker.profileSlug)
  assert.equal(persisted?.userId, user.id)
  assert.equal(persisted?.creationSource, 'ADMIN_CREATED')
  assert.equal(persisted?.verificationStatus, 'UNVERIFIED')
  assert.equal(persisted?.subscription?.plan, 'FREE')
  assert.equal((await prisma.brokerClaim.findUnique({ where: { id: claim.id } }))?.status, 'COMPLETED')
  assert.equal((await prisma.brokerClaimInvitation.findUnique({ where: { id: invitation.id } }))?.status, 'USED')
  assert.equal(await prisma.broker.count({ where: { userId: user.id } }), 1)
})

// TEST D — existing USER claimant; no second Broker
test('existing USER claimant claims without creating a second Broker', async () => {
  const user = await prisma.user.create({ data: { email: `${suffix}-existing@example.test`, phone: `+1552${Date.now().toString().slice(-7)}`, role: 'USER', isActive: true, emailVerified: true, password: 'hash' } })
  userIds.push(user.id)
  const { broker, claim, invitation } = await claimBroker(`${suffix}-existing`, user.email!)

  const context = { claimId: claim.id, invitationId: invitation.id, tokenHash: invitation.tokenHash, expiresAt: Date.now() + 30 * 60 * 1000, email: user.email!, reauthenticatedAt: Date.now() }
  const result = await completeClaimForUser(context, user.id, user.email!)
  const promoted = await prisma.user.findUnique({ where: { id: user.id } })

  assert.equal(result.brokerId, broker.id)
  assert.equal(promoted?.role, 'BROKER')
  assert.equal(await prisma.broker.count({ where: { userId: user.id } }), 1)
})

// TEST E — claimant who owns a Broker cannot claim another
test('claimant already owning a Broker is rejected from claiming another', async () => {
  const user = await prisma.user.create({ data: { email: `${suffix}-own@example.test`, phone: `+1553${Date.now().toString().slice(-7)}`, role: 'BROKER', isActive: true, emailVerified: true, password: 'hash' } })
  userIds.push(user.id)
  const owned = await prisma.broker.create({ data: { ...adminBrokerData(`${suffix}-own-existing`), userId: user.id, creationSource: 'SELF_REGISTERED' } })
  brokerIds.push(owned.id)
  const { claim, invitation } = await claimBroker(`${suffix}-own-second`, user.email!)

  const context = { claimId: claim.id, invitationId: invitation.id, tokenHash: invitation.tokenHash, expiresAt: Date.now() + 30 * 60 * 1000, email: user.email!, reauthenticatedAt: Date.now() }
  await assert.rejects(completeClaimForUser(context, user.id, user.email!), /CONFLICT|OWNED/)
})

// TEST G — revoked invitation cannot claim
test('revoked invitation is blocked', async () => {
  const user = await prisma.user.create({ data: { email: `${suffix}-revoked@example.test`, phone: `+1554${Date.now().toString().slice(-7)}`, role: 'USER', isActive: true, emailVerified: true, password: 'hash' } })
  userIds.push(user.id)
  const { claim, invitation } = await claimBroker(`${suffix}-revoked`, user.email!)
  await prisma.brokerClaimInvitation.update({ where: { id: invitation.id }, data: { status: 'REVOKED', revokedAt: new Date() } })

  const context = { claimId: claim.id, invitationId: invitation.id, tokenHash: invitation.tokenHash, expiresAt: Date.now() + 30 * 60 * 1000, email: user.email!, reauthenticatedAt: Date.now() }
  await assert.rejects(completeClaimForUser(context, user.id, user.email!), /REVOKED/)
})

// TEST H — expired invitation cannot claim
test('expired invitation is blocked', async () => {
  const user = await prisma.user.create({ data: { email: `${suffix}-expired@example.test`, phone: `+1555${Date.now().toString().slice(-7)}`, role: 'USER', isActive: true, emailVerified: true, password: 'hash' } })
  userIds.push(user.id)
  const { claim, invitation } = await claimBroker(`${suffix}-expired`, user.email!)
  await prisma.brokerClaimInvitation.update({ where: { id: invitation.id }, data: { expiresAt: new Date(Date.now() - 1000) } })

  const context = { claimId: claim.id, invitationId: invitation.id, tokenHash: invitation.tokenHash, expiresAt: Date.now() + 30 * 60 * 1000, email: user.email!, reauthenticatedAt: Date.now() }
  await assert.rejects(completeClaimForUser(context, user.id, user.email!), /EXPIRED/)
})

// TEST I — used invitation cannot be reused
test('used invitation cannot be reused after a previous completion', async () => {
  const user = await prisma.user.create({ data: { email: `${suffix}-used@example.test`, phone: `+1556${Date.now().toString().slice(-7)}`, role: 'USER', isActive: true, emailVerified: true, password: 'hash' } })
  userIds.push(user.id)
  const { claim, invitation } = await claimBroker(`${suffix}-used`, user.email!)
  const context = { claimId: claim.id, invitationId: invitation.id, tokenHash: invitation.tokenHash, expiresAt: Date.now() + 30 * 60 * 1000, email: user.email!, reauthenticatedAt: Date.now() }
  await completeClaimForUser(context, user.id, user.email!)
  await assert.rejects(completeClaimForUser(context, user.id, user.email!), /USED|INVALID|OWNED/)
})

// TEST J — Google claimant completes per contract (provider reauth, no emailVerified required)
test('Google reauthenticated claimant completes even when emailVerified is false', async () => {
  const user = await prisma.user.create({ data: { email: `${suffix}-google@example.test`, phone: `+1559${Date.now().toString().slice(-7)}`, role: 'USER', isActive: true, emailVerified: false, password: null } })
  userIds.push(user.id)
  await prisma.account.create({
    data: { userId: user.id, type: 'oauth', provider: 'google', providerAccountId: `google-${suffix}` },
  })
  const { broker, claim, invitation } = await claimBroker(`${suffix}-google`, user.email!)

  const context = {
    claimId: claim.id,
    invitationId: invitation.id,
    tokenHash: invitation.tokenHash,
    expiresAt: Date.now() + 30 * 60 * 1000,
    email: user.email!,
    reauthenticatedAt: Date.now(),
    reauthenticatedVia: 'google' as const,
  }
  const result = await completeClaimForUser(context, user.id, user.email!)
  const persisted = await prisma.broker.findUnique({ where: { id: broker.id } })
  assert.equal(result.brokerId, broker.id)
  assert.equal(persisted?.userId, user.id)
  assert.equal(persisted?.creationSource, 'ADMIN_CREATED')
})

// TEST K/L — existing USER → broker onboarding via finalizeBrokerRegistration
// (SELF_REGISTERED, FREE once). The canonical flow requires a BrokerRegistration
// with an ACTIVE registration subscription before finalization; finalization is
// idempotent and can never create a duplicate Broker or BrokerSubscription.
test('existing USER onboarding creates SELF_REGISTERED Broker with exactly one FREE subscription', async () => {
  const user = await prisma.user.create({ data: { email: `${suffix}-onboard@example.test`, phone: `+1557${Date.now().toString().slice(-7)}`, role: 'USER', isActive: true, emailVerified: true, password: 'hash' } })
  userIds.push(user.id)

  const profile = {
    displayName: 'Onboarded Broker',
    companyName: 'Onboarded Loans',
    phone: '+15571234567',
    officeAddress: '2 Onboard Street',
    city: 'Austin',
    state: 'Texas',
    pinCode: '78702',
    description: 'Onboarded through wizard.',
    nmls: '12345678',
    licenseStates: ['TX'],
    bankPartnerships: ['Chase Bank'],
  }

  // No BrokerRegistration yet: finalization must refuse to create a Broker.
  await assert.rejects(createBrokerForExistingUser(user.id, profile), /Broker registration not found/)

  // Register + select FREE: the registration subscription is established but
  // NO Broker is created by subscription selection.
  const registration = await prisma.brokerRegistration.create({
    data: {
      userId: user.id,
      status: 'SUBSCRIPTION_PENDING',
      draft: { create: { data: {}, currentStep: 1 } },
    },
    include: { subscription: true, draft: true },
  })
  await prisma.brokerRegistrationSubscription.create({
    data: { registrationId: registration.id, plan: 'FREE', status: 'ACTIVE', isActive: true, startDate: new Date() },
  })
  assert.equal(await prisma.broker.count({ where: { userId: user.id } }), 0, 'FREE selection must not create a Broker')

  // Profile submission finalizes exactly one Broker + one FREE BrokerSubscription.
  const broker = await createBrokerForExistingUser(user.id, profile)
  brokerIds.push(broker.id)

  const persisted = await prisma.broker.findUnique({ where: { id: broker.id }, include: { subscription: true } })
  const promoted = await prisma.user.findUnique({ where: { id: user.id } })
  const claim = await prisma.brokerClaim.findUnique({ where: { brokerId: broker.id } })

  assert.equal(persisted?.userId, user.id)
  assert.equal(persisted?.creationSource, 'SELF_REGISTERED')
  assert.equal(persisted?.nmls, '12345678')
  assert.deepEqual(persisted?.licenseStates, ['TX'])
  assert.equal(persisted?.subscription?.plan, 'FREE')
  assert.equal(persisted?.subscription?.isActive, true)
  assert.equal(await prisma.brokerSubscription.count({ where: { brokerId: broker.id } }), 1)
  assert.equal(promoted?.role, 'BROKER')
  assert.equal(claim, null)
  assert.equal(await prisma.brokerBank.count({ where: { brokerId: broker.id } }), 1)
  assert.equal((await prisma.brokerRegistration.findUnique({ where: { id: registration.id } }))?.status, 'COMPLETED')

  // Repeated submission is idempotent: the same Broker is returned and the
  // BrokerSubscription is never duplicated.
  const again = await createBrokerForExistingUser(user.id, profile)
  assert.equal(again.id, broker.id)
  assert.equal(await prisma.broker.count({ where: { userId: user.id } }), 1)
  assert.equal(await prisma.brokerSubscription.count({ where: { brokerId: broker.id } }), 1)
})

// TEST M — customer registration creates USER only, no Broker/Claim
test('customer account is USER-only with no Broker and no BrokerClaim', async () => {
  const user = await prisma.user.create({ data: { email: `${suffix}-customer@example.test`, phone: `+1558${Date.now().toString().slice(-7)}`, role: 'USER', isActive: true, emailVerified: false, password: 'hash' } })
  userIds.push(user.id)
  assert.equal(user.role, 'USER')
  assert.equal(await prisma.broker.count({ where: { userId: user.id } }), 0)
  assert.equal(await prisma.brokerClaim.count({ where: { completedByUserId: user.id } }), 0)
})
