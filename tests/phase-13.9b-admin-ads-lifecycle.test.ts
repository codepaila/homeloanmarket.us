import assert from 'node:assert/strict'
import test from 'node:test'
import { AdQuerySchema } from '../lib/advertisements/validation'
import { isPublicBroker } from '../lib/broker-policy'

const database = process.env.PHASE13_AUTH_DATABASE_URL
const adsBase = process.env.ADMIN_ADS_BASE_URL

test.after(async () => {
  if (database) {
    const { default: prisma } = await import('../lib/prisma')
    await prisma.$disconnect()
  }
})

test('Admin Ads query schema accepts page and limit with absent optional filters', () => {
  const result = AdQuerySchema.safeParse({ page: '1', limit: '10', placement: undefined, adType: undefined, isEnabled: undefined, isArchived: undefined, search: undefined })
  assert.equal(result.success, true)
  if (result.success) {
    assert.equal(result.data.page, 1)
    assert.equal(result.data.limit, 10)
  }
})

test('Seeded broker lifecycle combinations are valid and deliberate', { skip: !database }, async () => {
  const { default: prisma } = await import('../lib/prisma')
  const [brokers, subscriptions, claims, unowned] = await Promise.all([
    prisma.broker.findMany({ select: { id: true, profileSlug: true, userId: true, isVisible: true, verificationStatus: true, brokerStatus: true, user: { select: { isActive: true } } } }),
    prisma.brokerSubscription.findMany({ select: { brokerId: true, plan: true, isActive: true } }),
    prisma.brokerClaim.findMany({ select: { brokerId: true, status: true, completedByUserId: true } }),
    prisma.broker.count({ where: { userId: null } }),
  ])

  assert.equal(brokers.length, 8)
  assert.equal(unowned, 1)

  // No broker is visible AND unverified: that state is ambiguous for publication.
  for (const broker of brokers) {
    assert.equal(broker.isVisible && broker.verificationStatus === 'UNVERIFIED', false, broker.profileSlug)
  }

  // Public eligibility must match the authoritative predicate.
  const eligible = brokers.filter((broker) => isPublicBroker({
    isVisible: broker.isVisible,
    verificationStatus: broker.verificationStatus,
    brokerStatus: broker.brokerStatus,
    userId: broker.userId,
    userIsActive: broker.user?.isActive,
  })).length
  assert.ok(eligible >= 6, `expected at least 6 public brokers, got ${eligible}`)

  // FEATURED brokers must be verified, visible, and owned.
  const featuredSlugs = brokers.filter((broker) => broker.brokerStatus === 'FEATURED').map((broker) => broker.profileSlug)
  for (const broker of brokers.filter((b) => b.brokerStatus === 'FEATURED')) {
    assert.equal(broker.verificationStatus, 'VERIFIED')
    assert.equal(broker.isVisible, true)
    assert.ok(broker.userId)
  }
  assert.ok(featuredSlugs.length >= 2)

  // No PREMIUM subscriptions.
  assert.equal(subscriptions.some((subscription) => subscription.plan === 'PREMIUM'), false)

  // Claim states: one INVITED on an unowned broker, one COMPLETED on an owned broker.
  const invited = claims.filter((claim) => claim.status === 'INVITED')
  const completed = claims.filter((claim) => claim.status === 'COMPLETED')
  assert.equal(invited.length, 1)
  assert.equal(completed.length, 1)
  const invitedBroker = brokers.find((broker) => broker.id === invited[0].brokerId)
  assert.ok(invitedBroker && !invitedBroker.userId, 'INVITED claim must be on an unowned broker')
  const completedBroker = brokers.find((broker) => broker.id === completed[0].brokerId)
  assert.ok(completedBroker && completedBroker.userId, 'COMPLETED claim must be on an owned broker')
})

test('Seeded advertisements have valid explicit lifecycle fields', { skip: !database }, async () => {
  const { default: prisma } = await import('../lib/prisma')
  const ads = await prisma.advertisement.findMany({ select: { slug: true, placement: true, isEnabled: true, isArchived: true, isDeleted: true, startDate: true, endDate: true, createdById: true, bannerUrl: true } })
  assert.ok(ads.length >= 8)
  for (const ad of ads) {
    assert.ok(ad.createdById, `${ad.slug} missing owner`)
    assert.ok(ad.bannerUrl, `${ad.slug} missing creative`)
    assert.ok(ad.startDate, `${ad.slug} missing start`)
    assert.equal(ad.endDate === null || ad.endDate! >= ad.startDate!, true, `${ad.slug} reversed dates`)
    assert.equal(typeof ad.isEnabled, 'boolean')
    assert.equal(typeof ad.isArchived, 'boolean')
  }
  assert.equal(new Set(ads.map((ad) => ad.slug)).size, ads.length)
})

test('GET /api/admin/ads?page=1&limit=10 returns 200 for an authorized ADMIN', { skip: !adsBase }, async () => {
  const base = adsBase as string
  const cookieHeader = (response: Response) => response.headers.getSetCookie().map((part) => part.split(';')[0]).join('; ')
  const csrfResponse = await fetch(`${base}/api/auth/csrf`)
  const csrf = (await csrfResponse.json()).csrfToken as string
  const csrfCookie = cookieHeader(csrfResponse)
  const login = await fetch(`${base}/api/auth/callback/credentials`, {
    method: 'POST',
    redirect: 'manual',
    headers: { cookie: csrfCookie, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ csrfToken: csrf, email: 'admin@homeloanmarket.com', password: 'Admin@123456', callbackUrl: '/', json: 'true' }),
  })
  const cookie = [csrfCookie, ...login.headers.getSetCookie().map((part) => part.split(';')[0])].filter(Boolean).join('; ')

  const response = await fetch(`${base}/api/admin/ads?page=1&limit=10`, { headers: { cookie } })
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.success, true)
  assert.ok(Array.isArray(body.ads))
})
