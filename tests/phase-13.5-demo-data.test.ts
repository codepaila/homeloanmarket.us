import assert from 'node:assert/strict'
import test from 'node:test'
import { isPublicBroker } from '../lib/broker-policy'

const database = process.env.PHASE13_AUTH_DATABASE_URL

test.after(async () => {
  if (database) {
    const { default: prisma } = await import('../lib/prisma')
    await prisma.$disconnect()
  }
})

test('Phase 13.5 dataset has the expected US demo composition', { skip: !database }, async () => {
  const { default: prisma } = await import('../lib/prisma')

  const [users, brokers, subscriptions, reviews, contacts, claims, ads, mediaAssets] = await Promise.all([
    prisma.user.count(),
    prisma.broker.findMany({ select: { userId: true, isVisible: true, verificationStatus: true, brokerStatus: true, user: { select: { isActive: true } } } }),
    prisma.brokerSubscription.findMany({ select: { plan: true, isActive: true } }),
    prisma.review.count(),
    prisma.contactMessage.count(),
    prisma.brokerClaim.count(),
    prisma.advertisement.count(),
    prisma.mediaAsset.count({ where: { tags: { has: 'seed-owned' } } }),
  ])

  assert.equal(users, 18)
  assert.equal(brokers.length, 8)
  assert.equal(brokers.filter((broker) => broker.userId).length, 7)
  assert.equal(brokers.filter((broker) => !broker.userId).length, 1)
  const eligible = brokers.filter((broker) => isPublicBroker({
    isVisible: broker.isVisible,
    verificationStatus: broker.verificationStatus,
    brokerStatus: broker.brokerStatus,
    userId: broker.userId,
    userIsActive: broker.user?.isActive,
  })).length
  assert.equal(eligible, 7)

  assert.equal(subscriptions.filter((s) => s.plan === 'FREE' && s.isActive).length, 3)
  assert.equal(subscriptions.filter((s) => s.plan === 'FEATURED' && s.isActive).length, 3)
  assert.equal(subscriptions.filter((s) => s.plan === 'PREMIUM').length, 0)
  assert.equal(reviews, 14)
  assert.equal(contacts, 6)
  assert.equal(claims, 2)
  assert.equal(ads, 10)
  assert.ok(mediaAssets >= 12)
})

test('Phase 13.5 advertisement analytics are deterministic and valid', { skip: !database }, async () => {
  const { default: prisma } = await import('../lib/prisma')
  const events = await prisma.adEvent.findMany({ select: { advertisementId: true, eventType: true } })
  const impressions = events.filter((event) => event.eventType === 'IMPRESSION').length
  const clicks = events.filter((event) => event.eventType === 'CLICK').length

  assert.equal(impressions, 331)
  assert.equal(clicks, 30)
  assert.ok(clicks <= impressions)
  assert.equal(events.length, impressions + clicks)
})

test('Phase 13.5 has no duplicate or orphan records', { skip: !database }, async () => {
  const { default: prisma } = await import('../lib/prisma')
  const [brokers, reviews, contacts, claims, ads] = await Promise.all([
    prisma.broker.findMany({ select: { id: true, profileSlug: true, userId: true } }),
    prisma.review.findMany({ select: { brokerId: true } }),
    prisma.contactMessage.findMany({ select: { brokerId: true } }),
    prisma.brokerClaim.findMany({ select: { brokerId: true } }),
    prisma.advertisement.findMany({ select: { slug: true } }),
  ])
  const brokerIds = new Set(brokers.map((broker) => broker.id))
  const adIds = new Set((await prisma.advertisement.findMany({ select: { id: true } })).map((ad) => ad.id))
  const adEvents = await prisma.adEvent.findMany({ select: { advertisementId: true } })

  assert.equal(new Set(brokers.map((broker) => broker.profileSlug)).size, brokers.length)
  assert.equal(brokers.filter((broker) => broker.userId).map((broker) => broker.userId).filter((id, index, all) => all.indexOf(id) !== index).length, 0)
  assert.equal(reviews.filter((review) => !brokerIds.has(review.brokerId)).length, 0)
  assert.equal(contacts.filter((contact) => !brokerIds.has(contact.brokerId)).length, 0)
  assert.equal(claims.filter((claim) => !brokerIds.has(claim.brokerId)).length, 0)
  assert.equal(new Set(ads.map((ad) => ad.slug)).size, ads.length)
  assert.equal(adEvents.filter((event) => !adIds.has(event.advertisementId)).length, 0)
})

test('Phase 13.5 demo accounts authenticate through the real Credentials provider', { skip: !database }, async () => {
  const { default: prisma } = await import('../lib/prisma')
  const { authOptions } = await import('../lib/auth.config')
  const provider = authOptions.providers.find((candidate) => candidate.id === 'credentials') as typeof authOptions.providers[number] & {
    options: { authorize: (credentials: { email: string; password: string }) => Promise<{ role?: string } | null> }
  }

  try {
    const admin = await provider.options.authorize({ email: 'admin@homeloanmarket.com', password: 'Admin@123456' })
    assert.equal(admin?.role, 'ADMIN')
    const broker = await provider.options.authorize({ email: 'sarah.mitchell@example.com', password: 'LocalDev!2026' })
    assert.equal(broker?.role, 'BROKER')
    const user = await provider.options.authorize({ email: 'hannah.moore@example.com', password: 'LocalDev!2026' })
    assert.equal(user?.role, 'USER')
    assert.equal(await provider.options.authorize({ email: 'admin@homeloanmarket.com', password: 'wrong-password' }), null)
  } finally {
    await prisma.$disconnect()
  }
})

test('Phase 13.5 Admin Dashboard consumes the seeded data', { skip: !database }, async () => {
  const { default: prisma } = await import('../lib/prisma')
  const { getAdminDashboardData } = await import('../lib/admin/dashboard')

  try {
    const data = await getAdminDashboardData()
    assert.equal(data.overview.totalUsers, 18)
    assert.equal(data.overview.totalBrokers, 8)
    assert.ok(data.overview.totalProfileViews > 0)
    assert.ok(data.overview.adImpressions > 0)
    assert.ok(data.overview.adClicks > 0)
    assert.ok(data.overview.adCtr !== null && data.overview.adCtr > 0)
    assert.ok(data.activity.length > 0)
    assert.ok(data.userGrowth.some((point) => point.value > 0))
    assert.ok(data.brokerGrowth.some((point) => point.value > 0))
  } finally {
    await prisma.$disconnect()
  }
})
