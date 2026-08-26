import test, { before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import type { JWT } from 'next-auth/jwt'

type PrismaModule = typeof import('@/lib/prisma')
type AccountDeletionModule = typeof import('@/lib/account-deletion')
type AuthConfigModule = typeof import('@/lib/auth.config')

type StripeBehavior = 'success' | 'already-cancelled' | 'missing' | 'fail'

const stripeState = {
  subs: new Map<string, StripeBehavior>(),
  cancels: [] as Array<{ id: string; key?: string }>,
  retrieves: [] as string[],
  reset() {
    this.subs.clear()
    this.cancels = []
    this.retrieves = []
  },
  set(id: string, behavior: StripeBehavior) {
    this.subs.set(id, behavior)
  },
  client: {
    subscriptions: {
      retrieve: async (id: string) => {
        stripeState.retrieves.push(id)
        const behavior = stripeState.subs.get(id)
        if (!behavior || behavior === 'missing') {
          const error: Record<string, string> = { code: 'resource_missing' }
          throw error
        }
        if (behavior === 'already-cancelled') {
          return { id, status: 'canceled' }
        }
        return { id, status: 'active' }
      },
      cancel: async (_id: string, _params: Record<string, unknown>, options?: { idempotencyKey?: string }) => {
        const behavior = stripeState.subs.get(_id)
        if (!behavior || behavior === 'missing') {
          const error: Record<string, string> = { code: 'resource_missing' }
          throw error
        }
        if (behavior === 'fail') {
          throw new Error('simulated-stripe-failure')
        }
        stripeState.cancels.push({ id: _id, key: options?.idempotencyKey })
        return { id: _id, status: 'canceled' }
      },
    },
  },
}

const cloudinaryState = {
  calls: [] as string[],
  failNext: false,
  reset() {
    this.calls = []
    this.failNext = false
  },
}

let mongo: MongoMemoryReplSet
let prisma: PrismaModule['default']
let accountDeletionModule: AccountDeletionModule
let AccountDeletionService: AccountDeletionModule['AccountDeletionService']
let AccountDeletionStripeError: AccountDeletionModule['AccountDeletionStripeError']
let AccountDeletionError: AccountDeletionModule['AccountDeletionError']
let authOptions: AuthConfigModule['authOptions']

before(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { storageEngine: 'wiredTiger' } })
  process.env.DATABASE_URL = mongo.getUri('account_deletion_audit')
  const [{ default: prismaClient }, accountDeletion, authConfig] = await Promise.all([
    import('@/lib/prisma'),
    import('@/lib/account-deletion'),
    import('@/lib/auth.config'),
  ])
  prisma = prismaClient
  accountDeletionModule = accountDeletion
  AccountDeletionService = accountDeletion.AccountDeletionService
  AccountDeletionStripeError = accountDeletion.AccountDeletionStripeError
  AccountDeletionError = accountDeletion.AccountDeletionError
  authOptions = authConfig.authOptions
  accountDeletion.__setAccountDeletionTestHooks({
    stripeClient: async () => stripeState.client,
    cloudinaryDestroy: async (url) => {
      if (cloudinaryState.failNext) {
        cloudinaryState.failNext = false
        throw new Error('cloudinary-destroy-failed')
      }
      const publicId = accountDeletion.cloudinaryPublicIdFromUrl(url)
      if (publicId) cloudinaryState.calls.push(publicId)
    },
  })
  await prisma.$connect()
})

after(async () => {
  await cleanupLocalFiles()
  accountDeletionModule?.__setAccountDeletionTestHooks(null)
  await prisma?.$disconnect()
  await mongo?.stop()
})

beforeEach(async () => {
  await resetDatabase()
  stripeState.reset()
  cloudinaryState.reset()
  await cleanupLocalFiles()
})

async function resetDatabase() {
  try {
    await prisma.$runCommandRaw({ dropDatabase: 1 })
  } catch (error) {
    if (!(error instanceof Error) || !/ns not found/i.test(error.message)) {
      throw error
    }
  }
}

const createdFiles: string[] = []
let uniqueCounter = 0

function unique(prefix: string): string {
  uniqueCounter += 1
  return `${prefix}-${Date.now()}-${uniqueCounter}`
}

async function trackLocalFile(subPath: string, contents = 'test'): Promise<string> {
  const relative = path.join('uploads', subPath)
  const filePath = path.join(process.cwd(), 'public', relative)
  await fsp.mkdir(path.dirname(filePath), { recursive: true })
  await fsp.writeFile(filePath, contents)
  createdFiles.push(filePath)
  return `/${relative.replace(/\\/g, '/')}`
}

async function cleanupLocalFiles() {
  while (createdFiles.length) {
    const file = createdFiles.pop()
    if (!file) continue
    await fsp.rm(file, { force: true })
  }
}

type CreateUserOptions = {
  role?: 'USER' | 'BROKER' | 'ADMIN'
  email?: string
  phone?: string
  image?: string | null
}

async function createUser(options: CreateUserOptions = {}) {
  const suffix = unique('user')
  return prisma.user.create({
    data: {
      email: options.email ?? `${suffix}@example.test`,
      phone: options.phone ?? `+1555${Math.floor(Math.random() * 1_000_0000).toString().padStart(7, '0')}`,
      name: `Test ${suffix}`,
      role: options.role ?? 'USER',
      isActive: true,
      emailVerified: true,
      password: 'hashed',
      image: options.image ?? null,
    },
  })
}

type CreateBrokerOptions = {
  userId?: string | null
  creationSource?: 'ADMIN_CREATED' | 'SELF_REGISTERED'
  stripeSubId?: string | null
  logoUrl?: string | null
  coverUrl?: string | null
  profileUrl?: string | null
}

async function createBroker(options: CreateBrokerOptions) {
  const slug = unique('broker')
  return prisma.broker.create({
    data: {
      userId: options.userId ?? null,
      creationSource: options.creationSource ?? (options.userId ? 'SELF_REGISTERED' : 'ADMIN_CREATED'),
      displayName: `Broker ${slug}`,
      companyName: 'Broker Co',
      profileSlug: slug,
      description: 'Test broker profile',
      phone: '+15558675309',
      email: `${slug}@broker.test`,
      officeAddress: '1 Broker Way',
      city: 'Austin',
      state: 'TX',
      pinCode: '78701',
      licenseStates: ['TX'],
      verificationStatus: 'UNVERIFIED',
      brokerStatus: 'FREE',
      isVisible: true,
      logo: options.logoUrl ?? null,
      coverImage: options.coverUrl ?? null,
      profileImage: options.profileUrl ?? null,
      subscription: {
        create: {
          plan: 'FEATURED',
          isActive: true,
          startDate: new Date(),
          stripeSubId: options.stripeSubId ?? null,
        },
      },
    },
  })
}

type CreateCompanyOptions = {
  ownerId: string
  ownerRole?: 'OWNER' | 'MEMBER'
  stripeSubId?: string | null
}

async function createCompany(options: CreateCompanyOptions) {
  const name = `Company ${unique('company')}`
  const company = await prisma.company.create({
    data: {
      name,
      type: 'HOME_LOAN_COMPANY',
      address: '1 Company Way',
      contactName: 'Owner Name',
      contactPosition: 'CEO',
      phone: '+15551231234',
      bannerAddress: '2 Banner Way',
      bannerPhone: '+15559876543',
      status: 'ACTIVE',
    },
  })

  await prisma.companyMembership.create({
    data: {
      companyId: company.id,
      userId: options.ownerId,
      role: options.ownerRole ?? 'OWNER',
      isActive: true,
    },
  })

  if (options.stripeSubId !== undefined) {
    await prisma.companySubscription.create({
      data: {
        companyId: company.id,
        plan: 'ADVERTISING',
        status: 'ACTIVE',
        isActive: true,
        stripeSubId: options.stripeSubId,
        startDate: new Date(),
      },
    })
  }

  return company
}

async function createSupportTicket(userId: string) {
  const ticket = await prisma.supportTicket.create({
    data: {
      userId,
      ticketNumber: unique('TKT'),
      category: 'billing',
      subject: 'Test ticket',
      description: 'Test description',
    },
  })
  await prisma.supportMessage.create({
    data: {
      ticketId: ticket.id,
      senderId: userId,
      senderType: 'user',
      message: 'Need help',
      attachments: [],
    },
  })
  return ticket
}

async function createBrokerClaimLifecycle(brokerId: string, adminUserId: string) {
  const claim = await prisma.brokerClaim.create({
    data: {
      brokerId,
      status: 'COMPLETED',
      completedAt: new Date(),
      completedByUserId: adminUserId,
    },
  })

  const invitation = await prisma.brokerClaimInvitation.create({
    data: {
      brokerClaimId: claim.id,
      tokenHash: unique('token'),
      recipientEmail: `${unique('invite')}@example.test`,
      status: 'USED',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdById: adminUserId,
    },
  })

  await prisma.brokerClaimEvent.createMany({
    data: [
      {
        brokerClaimId: claim.id,
        invitationId: invitation.id,
        actorUserId: adminUserId,
        eventType: 'GENERATED',
      },
      {
        brokerClaimId: claim.id,
        invitationId: invitation.id,
        actorUserId: adminUserId,
        eventType: 'COMPLETED',
      },
    ],
  })

  return { claim, invitation }
}

test('B1: self-registered broker deletion removes dependent records and media', async () => {
  const avatarUrl = 'https://res.cloudinary.com/demo/image/upload/v123/homeloanmarket/users/avatar/test-user'
  const user = await createUser({ role: 'BROKER', image: avatarUrl })
  const logo = await trackLocalFile(path.join('brokers', `${unique('logo')}.webp`))
  const cover = await trackLocalFile(path.join('brokers', `${unique('cover')}.webp`))
  const profile = await trackLocalFile(path.join('brokers', `${unique('profile')}.webp`))
  const broker = await createBroker({ userId: user.id, creationSource: 'SELF_REGISTERED', logoUrl: logo, coverUrl: cover, profileUrl: profile })

  const exclusiveAssetUrl = await trackLocalFile(path.join('media', `${unique('asset')}.webp`))
  const media = await prisma.mediaAsset.create({
    data: {
      fileName: path.basename(exclusiveAssetUrl),
      originalName: 'banner.webp',
      fileUrl: exclusiveAssetUrl,
      mimeType: 'image/webp',
      extension: 'webp',
      fileSize: 1200,
      uploaderId: user.id,
    },
  })

  await prisma.notification.create({ data: { userId: user.id, title: 'Notice', message: 'Test' } })
  await prisma.message.create({ data: { senderId: user.id, receiverId: user.id, conversationId: unique('conv'), message: 'Hello', attachments: [] } })
  await prisma.contactMessage.create({ data: { brokerId: broker.id, userId: user.id, name: 'Lead', phone: '+15550000000', message: 'Interested' } })
  await prisma.review.create({ data: { brokerId: broker.id, userId: user.id, rating: 5, comment: 'Great' } })
  await prisma.brokerBank.create({ data: { brokerId: broker.id, bankName: 'Test Bank', bankType: 'PUBLIC' } })
  await createSupportTicket(user.id)

  const ad = await prisma.advertisement.create({
    data: {
      title: 'User Ad',
      slug: unique('ad'),
      placement: 'HOMEPAGE_HERO',
      type: 'HERO_BANNER',
      action: 'DISPLAY_ONLY',
      createdById: user.id,
      buttonVariant: 'PRIMARY',
      isEnabled: true,
    },
  })

  const otherUser = await createUser({ role: 'USER' })

  const result = await AccountDeletionService.deleteBrokerAccount({ brokerId: broker.id }, { userId: user.id, role: 'BROKER' })
  assert.equal(result.deleted.broker, true)
  assert.equal(result.deleted.user, true)

  assert.equal(await prisma.broker.count({ where: { id: broker.id } }), 0)
  assert.equal(await prisma.user.count({ where: { id: user.id } }), 0)
  assert.equal(await prisma.mediaAsset.count({ where: { id: media.id } }), 0)
  assert.equal(await prisma.advertisement.count({ where: { id: ad.id } }), 0)
  assert.equal(await prisma.notification.count({ where: { userId: user.id } }), 0)
  assert.equal(await prisma.contactMessage.count({ where: { brokerId: broker.id } }), 0)
  assert.equal(await prisma.review.count({ where: { brokerId: broker.id } }), 0)
  assert.equal(await prisma.supportTicket.count({ where: { userId: user.id } }), 0)
  assert.equal(await prisma.message.count({ where: { senderId: user.id } }), 0)
  assert.equal(await prisma.user.count({ where: { id: otherUser.id } }), 1)

  for (const file of [logo, cover, profile, exclusiveAssetUrl]) {
    const absolute = path.join(process.cwd(), 'public', file.slice(1))
    assert.equal(fs.existsSync(absolute), false, `${file} should be removed from disk`)
  }

})

test('Cloudinary helper derives public ids for remote URLs', async () => {
  cloudinaryState.reset()
  await accountDeletionModule.removeCloudinaryFileByUrl('https://res.cloudinary.com/demo/image/upload/v123/homeloanmarket/users/avatar/test-user')
  assert.equal(cloudinaryState.calls.includes('homeloanmarket/users/avatar/test-user'), true)
})

test('B2: admin can delete an unclaimed broker and its dependencies', async () => {
  const admin = await createUser({ role: 'ADMIN' })
  const broker = await createBroker({ userId: null, creationSource: 'ADMIN_CREATED' })
  await prisma.brokerBank.create({ data: { brokerId: broker.id, bankName: 'Admin Bank', bankType: 'PUBLIC' } })
  await prisma.contactMessage.create({ data: { brokerId: broker.id, name: 'Lead', phone: '+15557778888', message: 'Question' } })

  const result = await AccountDeletionService.deleteBrokerAccount({ brokerId: broker.id }, { userId: admin.id, role: 'ADMIN' })
  assert.equal(result.deleted.broker, true)
  assert.equal(result.deleted.user, undefined)

  assert.equal(await prisma.broker.count({ where: { id: broker.id } }), 0)
  assert.equal(await prisma.brokerBank.count({ where: { brokerId: broker.id } }), 0)
  assert.equal(await prisma.contactMessage.count({ where: { brokerId: broker.id } }), 0)
})

test('B3: claimed broker deletion removes claim lifecycle and the user', async () => {
  const admin = await createUser({ role: 'ADMIN' })
  const owner = await createUser({ role: 'BROKER' })
  const broker = await createBroker({ userId: owner.id, creationSource: 'ADMIN_CREATED' })
  await createBrokerClaimLifecycle(broker.id, admin.id)

  const result = await AccountDeletionService.deleteBrokerAccount({ brokerId: broker.id }, { userId: admin.id, role: 'ADMIN' })
  assert.equal(result.deleted.broker, true)
  assert.equal(result.deleted.user, true)

  assert.equal(await prisma.broker.count({ where: { id: broker.id } }), 0)
  assert.equal(await prisma.user.count({ where: { id: owner.id } }), 0)
  assert.equal(await prisma.brokerClaim.count({ where: { brokerId: broker.id } }), 0)
  assert.equal(await prisma.brokerClaimInvitation.count(), 0)
  assert.equal(await prisma.brokerClaimEvent.count(), 0)
})

test('B4: active Stripe subscription is cancelled before broker deletion', async () => {
  const subId = unique('sub')
  stripeState.set(subId, 'success')
  const owner = await createUser({ role: 'BROKER' })
  const broker = await createBroker({ userId: owner.id, stripeSubId: subId })

  const result = await AccountDeletionService.deleteBrokerAccount({ brokerId: broker.id }, { userId: owner.id, role: 'BROKER' })
  assert.equal(result.deleted.broker, true)
  assert.equal(result.stripeCancelled.includes(subId), true)
  assert.equal(stripeState.cancels.length, 1)
  assert.equal(stripeState.cancels[0]?.key, `account_delete_broker_${broker.id}_${subId}`)
  assert.equal(await prisma.broker.count({ where: { id: broker.id } }), 0)
})

test('broker deletion tolerates missing Stripe subscription records', async () => {
  const subId = unique('sub-missing')
  stripeState.set(subId, 'missing')
  const owner = await createUser({ role: 'BROKER' })
  const broker = await createBroker({ userId: owner.id, stripeSubId: subId })

  const result = await AccountDeletionService.deleteBrokerAccount({ brokerId: broker.id }, { userId: owner.id, role: 'BROKER' })
  assert.equal(result.deleted.broker, true)
  assert.equal(result.stripeCancelled.includes(subId), false)
  assert.equal(await prisma.broker.count({ where: { id: broker.id } }), 0)
})

test('B5: Stripe cancellation failure preserves broker data for retry', async () => {
  const subId = unique('sub')
  stripeState.set(subId, 'fail')
  const owner = await createUser({ role: 'BROKER' })
  const broker = await createBroker({ userId: owner.id, stripeSubId: subId })

  await assert.rejects(
    () => AccountDeletionService.deleteBrokerAccount({ brokerId: broker.id }, { userId: owner.id, role: 'BROKER' }),
    AccountDeletionStripeError,
  )

  assert.equal(await prisma.broker.count({ where: { id: broker.id } }), 1)
  assert.equal(await prisma.user.count({ where: { id: owner.id } }), 1)
  assert.equal(stripeState.cancels.length, 0)
})

test('C1: company owner deletion cascades ads, requests, media, and subscription', async () => {
  const subId = unique('sub-comp')
  stripeState.set(subId, 'success')
  const owner = await createUser({ role: 'USER' })
  const company = await createCompany({ ownerId: owner.id, stripeSubId: subId })

  const plan = await prisma.companyAdvertisingPlan.create({
    data: {
      name: `Plan ${unique('plan')}`,
      price: 10000,
      currency: 'usd',
    },
  })
  await prisma.companySubscription.update({ where: { companyId: company.id }, data: { planId: plan.id } })

  await prisma.companyAdRequest.create({
    data: {
      companyId: company.id,
      requestedById: owner.id,
      status: 'REQUESTED',
    },
  })

  const exclusiveUrl = await trackLocalFile(path.join('media', `${unique('exclusive')}.webp`))
  const sharedUrl = await trackLocalFile(path.join('media', `${unique('shared')}.webp`))

  const exclusiveAsset = await prisma.mediaAsset.create({
    data: {
      fileName: path.basename(exclusiveUrl),
      originalName: 'exclusive.webp',
      fileUrl: exclusiveUrl,
      mimeType: 'image/webp',
      extension: 'webp',
      fileSize: 2048,
      uploaderId: owner.id,
    },
  })

  const sharedUploader = await createUser({ role: 'USER' })
  const sharedAsset = await prisma.mediaAsset.create({
    data: {
      fileName: path.basename(sharedUrl),
      originalName: 'shared.webp',
      fileUrl: sharedUrl,
      mimeType: 'image/webp',
      extension: 'webp',
      fileSize: 4096,
      uploaderId: sharedUploader.id,
    },
  })

  const companyAd = await prisma.advertisement.create({
    data: {
      title: 'Company Ad',
      slug: unique('company-ad'),
      placement: 'BROKER_LISTING',
      type: 'SIDEBAR_BANNER',
      action: 'DISPLAY_ONLY',
      desktopMediaId: exclusiveAsset.id,
      createdById: owner.id,
      companyId: company.id,
      buttonVariant: 'PRIMARY',
      isEnabled: true,
    },
  })

  const otherOwner = await createUser({ role: 'USER' })
  const otherCompany = await createCompany({ ownerId: otherOwner.id })
  await prisma.advertisement.create({
    data: {
      title: 'Shared Ad',
      slug: unique('shared-ad'),
      placement: 'HOMEPAGE_FEATURED',
      type: 'SECTION_BANNER',
      action: 'DISPLAY_ONLY',
      desktopMediaId: sharedAsset.id,
      createdById: otherOwner.id,
      companyId: otherCompany.id,
      buttonVariant: 'PRIMARY',
      isEnabled: true,
    },
  })

  await prisma.advertisement.create({
    data: {
      title: 'Shared Ad B',
      slug: unique('shared-ad-b'),
      placement: 'BROKER_LISTING',
      type: 'SIDEBAR_BANNER',
      action: 'DISPLAY_ONLY',
      desktopMediaId: sharedAsset.id,
      createdById: otherOwner.id,
      companyId: otherCompany.id,
      buttonVariant: 'PRIMARY',
      isEnabled: true,
    },
  })

  const result = await AccountDeletionService.deleteCompanyAccount({ companyId: company.id }, { userId: owner.id, role: 'USER' })
  assert.equal(result.deleted.company, true)
  assert.equal(result.deleted.user, true)
  assert.equal(result.stripeCancelled.includes(subId), true)

  assert.equal(await prisma.company.count({ where: { id: company.id } }), 0)
  assert.equal(await prisma.companyMembership.count({ where: { companyId: company.id } }), 0)
  assert.equal(await prisma.companySubscription.count({ where: { companyId: company.id } }), 0)
  assert.equal(await prisma.companyAdRequest.count({ where: { companyId: company.id } }), 0)
  assert.equal(await prisma.advertisement.count({ where: { id: companyAd.id } }), 0)
  assert.equal(await prisma.mediaAsset.count({ where: { id: exclusiveAsset.id } }), 0)
  assert.equal(await prisma.user.count({ where: { id: owner.id } }), 0)
  assert.equal(await prisma.companyAdvertisingPlan.count({ where: { id: plan.id } }), 1)

  assert.equal(await prisma.mediaAsset.count({ where: { id: sharedAsset.id } }), 1)
  assert.equal(await prisma.company.count({ where: { id: otherCompany.id } }), 1)
})

test('C4: Stripe cancellation failure blocks company deletion', async () => {
  const subId = unique('sub-comp-fail')
  stripeState.set(subId, 'fail')
  const owner = await createUser({ role: 'USER' })
  const company = await createCompany({ ownerId: owner.id, stripeSubId: subId })

  await assert.rejects(
    () => AccountDeletionService.deleteCompanyAccount({ companyId: company.id }, { userId: owner.id, role: 'USER' }),
    AccountDeletionStripeError,
  )

  assert.equal(await prisma.company.count({ where: { id: company.id } }), 1)
  assert.equal(await prisma.user.count({ where: { id: owner.id } }), 1)
})

test('company deletion continues when Stripe subscription is already missing', async () => {
  const subId = unique('sub-comp-missing')
  stripeState.set(subId, 'missing')
  const owner = await createUser({ role: 'USER' })
  const company = await createCompany({ ownerId: owner.id, stripeSubId: subId })

  const result = await AccountDeletionService.deleteCompanyAccount({ companyId: company.id }, { userId: owner.id, role: 'USER' })
  assert.equal(result.deleted.company, true)
  assert.equal(await prisma.company.count({ where: { id: company.id } }), 0)
})

test('admin can delete a company without owning it', async () => {
  const admin = await createUser({ role: 'ADMIN' })
  const owner = await createUser({ role: 'USER' })
  const company = await createCompany({ ownerId: owner.id })

  const result = await AccountDeletionService.deleteCompanyAccount({ companyId: company.id }, { userId: admin.id, role: 'ADMIN' })
  assert.equal(result.deleted.company, true)
  assert.equal(await prisma.company.count({ where: { id: company.id } }), 0)
})

test('U2: broker deletion retains user with active company membership', async () => {
  const member = await createUser({ role: 'BROKER' })
  const owner = await createUser({ role: 'USER' })
  const company = await createCompany({ ownerId: owner.id })
  await prisma.companyMembership.create({ data: { companyId: company.id, userId: member.id, role: 'MEMBER', isActive: true } })
  const broker = await createBroker({ userId: member.id, creationSource: 'SELF_REGISTERED' })

  const result = await AccountDeletionService.deleteBrokerAccount({ brokerId: broker.id }, { userId: member.id, role: 'BROKER' })
  assert.equal(result.deleted.broker, true)
  assert.equal(result.deleted.user, false)
  assert.equal(await prisma.user.count({ where: { id: member.id } }), 1)
  assert.equal(await prisma.companyMembership.count({ where: { companyId: company.id, userId: member.id } }), 1)
})

test('U3: company deletion retains broker/user when other context exists', async () => {
  const owner = await createUser({ role: 'BROKER' })
  const broker = await createBroker({ userId: owner.id, creationSource: 'SELF_REGISTERED' })
  const company = await createCompany({ ownerId: owner.id })

  const result = await AccountDeletionService.deleteCompanyAccount({ companyId: company.id }, { userId: owner.id, role: 'BROKER' })
  assert.equal(result.deleted.company, true)
  assert.equal(result.deleted.user, false)
  assert.equal(await prisma.user.count({ where: { id: owner.id } }), 1)
  assert.equal(await prisma.broker.count({ where: { id: broker.id } }), 1)
})

test('U5: admin-linked broker cannot be deleted through the broker service', async () => {
  const admin = await createUser({ role: 'ADMIN' })
  const broker = await createBroker({ userId: admin.id, creationSource: 'SELF_REGISTERED' })

  await assert.rejects(
    () => AccountDeletionService.deleteBrokerAccount({ brokerId: broker.id }, { userId: admin.id, role: 'ADMIN' }),
    AccountDeletionError,
  )
  assert.equal(await prisma.broker.count({ where: { id: broker.id } }), 1)
})

test('M5: cloudinary cleanup failures do not break deletion', async () => {
  cloudinaryState.failNext = true
  const avatarUrl = 'https://res.cloudinary.com/demo/image/upload/v123/homeloanmarket/users/avatar/cloud-fail'
  const user = await createUser({ role: 'BROKER', image: avatarUrl })
  const broker = await createBroker({ userId: user.id, creationSource: 'SELF_REGISTERED' })

  const result = await AccountDeletionService.deleteBrokerAccount({ brokerId: broker.id }, { userId: user.id, role: 'BROKER' })
  assert.equal(result.deleted.broker, true)
  assert.equal(await prisma.user.count({ where: { id: user.id } }), 0)
  assert.equal(cloudinaryState.calls.includes('homeloanmarket/users/avatar/cloud-fail'), false)
})

test('H: deleted user session is invalidated by the Auth.js JWT callback', async () => {
  const user = await createUser({ role: 'BROKER' })
  const broker = await createBroker({ userId: user.id, creationSource: 'SELF_REGISTERED' })
  await AccountDeletionService.deleteBrokerAccount({ brokerId: broker.id }, { userId: user.id, role: 'BROKER' })

  const jwtCallback = authOptions.callbacks?.jwt
  assert.ok(jwtCallback, 'jwt callback must exist')
  const token = { email: user.email } as JWT
  const refreshed = await (jwtCallback as unknown as ({ token }: { token: JWT }) => Promise<JWT>)({ token })
  assert.deepEqual(refreshed, {})
})

test('I: concurrent broker deletion requests are idempotent', async () => {
  const user = await createUser({ role: 'BROKER' })
  const broker = await createBroker({ userId: user.id, creationSource: 'SELF_REGISTERED' })

  const attempts = await Promise.allSettled([
    AccountDeletionService.deleteBrokerAccount({ brokerId: broker.id }, { userId: user.id, role: 'BROKER' }),
    AccountDeletionService.deleteBrokerAccount({ brokerId: broker.id }, { userId: user.id, role: 'BROKER' }),
  ])

  const successes = attempts.filter((result) => result.status === 'fulfilled') as PromiseFulfilledResult<unknown>[]
  const failures = attempts.filter((result) => result.status === 'rejected') as PromiseRejectedResult[]
  assert.equal(successes.length, 1)
  assert.equal(failures.length, 1)
  const rejection = failures[0]?.reason as AccountDeletionError | { code?: string; message?: string } | undefined
  assert.ok(
    rejection instanceof AccountDeletionError ||
      rejection?.code === 'BROKER_NOT_FOUND' ||
      rejection?.code === 'P2034' ||
      rejection?.message?.includes('Broker not found'),
  )
  assert.equal(await prisma.broker.count({ where: { id: broker.id } }), 0)
  assert.equal(await prisma.user.count({ where: { id: user.id } }), 0)
})

test('plain user deletion cancels registration subscriptions and media', async () => {
  const subId = unique('reg-sub')
  stripeState.set(subId, 'success')
  const user = await createUser({ role: 'USER' })
  const avatar = await trackLocalFile(path.join('media', `${unique('user-image')}.png`))
  await prisma.user.update({ where: { id: user.id }, data: { image: avatar } })
  await prisma.brokerRegistration.create({
    data: {
      userId: user.id,
      status: 'ONBOARDING_IN_PROGRESS',
      subscription: {
        create: {
          plan: 'FEATURED',
          status: 'ACTIVE',
          isActive: true,
          stripeSubId: subId,
        },
      },
    },
  })

  const result = await AccountDeletionService.deleteUserAccount({ userId: user.id }, { userId: user.id, role: 'USER' })
  assert.equal(result.deleted.user, true)
  assert.equal(result.stripeCancelled.includes(subId), true)
  assert.equal(await prisma.user.count({ where: { id: user.id } }), 0)
  const absolute = path.join(process.cwd(), 'public', avatar.slice(1))
  assert.equal(fs.existsSync(absolute), false)
})
