import assert from 'node:assert/strict'
import test from 'node:test'
import { isPublicBroker } from '../lib/broker-policy'

const database = process.env.PHASE13_AUTH_DATABASE_URL

const FORBIDDEN = ['demo', 'test', 'sample', 'example', 'seed']

function containsForbidden(value: string) {
  return FORBIDDEN.some((word) => new RegExp(`\\b${word}\\b`, 'i').test(value))
}

test.after(async () => {
  if (database) {
    const { default: prisma } = await import('../lib/prisma')
    await prisma.$disconnect()
  }
})

test('Clean seed has expected compact dataset', { skip: !database }, async () => {
  const { default: prisma } = await import('../lib/prisma')
  const [users, brokers, subscriptions, reviews, contacts, claims, ads, mediaAssets, mediaFolders, blogs] = await Promise.all([
    prisma.user.findMany({ select: { email: true, role: true } }),
    prisma.broker.findMany({ select: { userId: true, isVisible: true, verificationStatus: true, brokerStatus: true, user: { select: { isActive: true } } } }),
    prisma.brokerSubscription.findMany({ select: { plan: true, isActive: true } }),
    prisma.review.count(),
    prisma.contactMessage.count(),
    prisma.brokerClaim.count(),
    prisma.advertisement.count(),
    prisma.mediaAsset.count(),
    prisma.mediaFolder.count(),
    prisma.blogPost.findMany({ select: { isPublished: true } }),
  ])

  assert.equal(users.filter((user) => user.role === 'ADMIN').length, 1)
  assert.ok(users.filter((user) => user.role === 'USER').length >= 8 && users.filter((user) => user.role === 'USER').length <= 12)
  assert.equal(brokers.length, 6)
  assert.equal(brokers.filter((broker) => broker.userId).length, 5)
  assert.equal(brokers.filter((broker) => !broker.userId).length, 1)
  const eligible = brokers.filter((broker) => isPublicBroker({
    isVisible: broker.isVisible,
    verificationStatus: broker.verificationStatus,
    brokerStatus: broker.brokerStatus,
    userId: broker.userId,
    userIsActive: broker.user?.isActive,
  })).length
  assert.ok(eligible >= 4 && eligible <= 5)
  assert.ok(subscriptions.filter((s) => s.isActive).length >= 4 && subscriptions.filter((s) => s.isActive).length <= 5)
  assert.equal(subscriptions.filter((s) => s.plan === 'PREMIUM').length, 0)
  assert.ok(reviews >= 10 && reviews <= 15)
  assert.ok(contacts >= 5 && contacts <= 10)
  assert.ok(claims >= 2)
  assert.ok(ads >= 18 && ads <= 20)
  assert.ok(mediaAssets >= 12)
  assert.ok(mediaFolders >= 2 && mediaFolders <= 4)
  assert.equal(blogs.filter((blog) => blog.isPublished).length, 4)
  assert.equal(blogs.filter((blog) => !blog.isPublished).length, 1)
})

test('Clean seed has no public-facing demo/test/sample naming', { skip: !database }, async () => {
  const { default: prisma } = await import('../lib/prisma')
  const [brokers, users, ads, blogs] = await Promise.all([
    prisma.broker.findMany({ select: { displayName: true, companyName: true, description: true, city: true, state: true } }),
    prisma.user.findMany({ select: { name: true, role: true } }),
    prisma.advertisement.findMany({ select: { title: true, description: true } }),
    prisma.blogPost.findMany({ select: { title: true, excerpt: true, author: true, category: true } }),
  ])

  for (const broker of brokers) {
    for (const field of [broker.displayName, broker.companyName || '', broker.description, broker.city || '', broker.state || '']) {
      assert.equal(containsForbidden(field), false, `Broker forbidden naming: ${field}`)
    }
  }
  for (const user of users) {
    if (user.role === 'ADMIN') continue
    assert.equal(containsForbidden(user.name || ''), false, `User forbidden naming: ${user.name}`)
  }
  for (const ad of ads) {
    assert.equal(containsForbidden(ad.title), false, `Ad forbidden naming: ${ad.title}`)
    assert.equal(containsForbidden(ad.description || ''), false)
  }
  for (const blog of blogs) {
    assert.equal(containsForbidden(blog.title), false, `Blog forbidden naming: ${blog.title}`)
    assert.equal(containsForbidden(blog.excerpt || ''), false)
  }
})

test('Every public Broker has a valid configured image URL', { skip: !database }, async () => {
  const { default: prisma } = await import('../lib/prisma')
  const brokers = await prisma.broker.findMany({ where: { isVisible: true }, select: { displayName: true, logo: true, coverImage: true } })
  for (const broker of brokers) {
    assert.ok(broker.logo, `${broker.displayName} has no logo`)
    assert.ok(broker.logo.startsWith('https://images.unsplash.com/'), `${broker.displayName} logo host not configured`)
    assert.ok(broker.coverImage, `${broker.displayName} has no cover image`)
    assert.ok(broker.coverImage.startsWith('https://images.unsplash.com/'), `${broker.displayName} cover host not configured`)
  }
})

test('Next.js remote image configuration allows images.unsplash.com', async () => {
  const mod = await import('../next.config')
  const config = mod.default
  const patterns = config?.images?.remotePatterns || []
  const hosts = patterns.map((pattern: { hostname?: string }) => pattern.hostname)
  assert.ok(hosts.includes('images.unsplash.com'))
})

test('Claim scenarios exist with valid ownership state', { skip: !database }, async () => {
  const { default: prisma } = await import('../lib/prisma')
  const claims = await prisma.brokerClaim.findMany({ select: { status: true, brokerId: true } })
  const unowned = await prisma.broker.findMany({ where: { userId: null }, select: { id: true } })
  assert.ok(claims.length >= 2)
  assert.equal(unowned.length, 1)
  const statuses = claims.map((claim) => claim.status)
  assert.ok(statuses.includes('INVITED'))
  assert.ok(statuses.includes('COMPLETED'))
})

test('Clean seed has no duplicates or orphans and modest profile views', { skip: !database }, async () => {
  const { default: prisma } = await import('../lib/prisma')
  const [brokers, reviews, contacts, ads, events] = await Promise.all([
    prisma.broker.findMany({ select: { id: true, profileSlug: true, userId: true, profileViews: true } }),
    prisma.review.findMany({ select: { brokerId: true } }),
    prisma.contactMessage.findMany({ select: { brokerId: true } }),
    prisma.advertisement.findMany({ select: { slug: true } }),
    prisma.adEvent.findMany({ select: { advertisementId: true } }),
  ])
  const brokerIds = new Set(brokers.map((broker) => broker.id))
  const adIds = new Set((await prisma.advertisement.findMany({ select: { id: true } })).map((ad) => ad.id))

  assert.equal(new Set(brokers.map((broker) => broker.profileSlug)).size, brokers.length)
  assert.equal(brokers.filter((broker) => broker.userId).map((broker) => broker.userId).filter((id, index, all) => all.indexOf(id) !== index).length, 0)
  assert.equal(reviews.filter((review) => !brokerIds.has(review.brokerId)).length, 0)
  assert.equal(contacts.filter((contact) => !brokerIds.has(contact.brokerId)).length, 0)
  assert.equal(new Set(ads.map((ad) => ad.slug)).size, ads.length)
  assert.equal(events.filter((event) => !adIds.has(event.advertisementId)).length, 0)

   assert.equal(events.length, 0)
  for (const broker of brokers) {
    assert.ok(broker.profileViews >= 50 && broker.profileViews <= 2500, `${broker.profileSlug} views ${broker.profileViews}`)
  }
})
