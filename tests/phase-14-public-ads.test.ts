import assert from 'node:assert/strict'
import test from 'node:test'

const database = process.env.PHASE14_DATABASE_URL
const base = process.env.PUBLIC_ADS_BASE_URL

test.after(async () => {
  if (database) {
    const { default: prisma } = await import('../lib/prisma')
    await prisma.$disconnect()
  }
})

test('public eligibility excludes future advertisements', { skip: !database }, async () => {
  const { default: prisma } = await import('../lib/prisma')
  const { AdvertisementService } = await import('../lib/advertisements/services')
  const now = new Date()
  const [active, future] = await Promise.all([
    prisma.advertisement.findFirst({ where: { isEnabled: true, isArchived: false, isDeleted: false, startDate: { lte: now }, OR: [{ endDate: null }, { endDate: { gte: now } }] }, select: { placement: true } }),
    prisma.advertisement.findFirst({ where: { isEnabled: true, isArchived: false, isDeleted: false, startDate: { gt: now } }, select: { id: true, placement: true } }),
  ])
  assert.ok(active)
  const ads = await AdvertisementService.findActiveAds(active.placement, 'desktop', 100, now)
  assert.ok(ads.length > 0)
  if (future) {
    const futureAds = await AdvertisementService.findActiveAds(future.placement, 'desktop', 100, now)
    assert.equal(futureAds.some((ad) => ad.id === future.id), false)
  }
  await prisma.$disconnect()
})

test('public advertisement API and tracking work without authentication', { skip: !base }, async () => {
  const response = await fetch(`${base}/api/ads/public?placement=homepage-hero`)
  assert.equal(response.status, 200)
  const body = await response.json() as { ads: Array<{ id: string }> }
  assert.ok(Array.isArray(body.ads))
  assert.ok(body.ads[0]?.id)

  const id = body.ads[0].id
  const impression = await fetch(`${base}/api/ads/impression`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ advertisementId: id, page: '/' }),
  })
  assert.equal(impression.status, 200)

  const click = await fetch(`${base}/api/ads/click`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ advertisementId: id, page: '/' }),
  })
  assert.equal(click.status, 200)
})

test('admin advertisement management remains protected without authentication', { skip: !base }, async () => {
  const response = await fetch(`${base}/api/admin/ads?page=1&limit=1`, { redirect: 'manual' })
  assert.equal(response.status, 307)
})
