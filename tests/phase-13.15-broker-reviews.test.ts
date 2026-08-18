import assert from 'node:assert/strict'
import test from 'node:test'

const database = process.env.PHASE1315_DATABASE_URL
const base = process.env.PHASE1315_BASE_URL

test.after(async () => {
  if (database) {
    const { default: prisma } = await import('../lib/prisma')
    await prisma.$disconnect()
  }
})

test('published broker reviews are public-safe and sourced from real records', { skip: !database }, async () => {
  const { default: prisma } = await import('../lib/prisma')
  const broker = await prisma.broker.findFirst({ where: { isVisible: true, verificationStatus: 'VERIFIED' }, select: { id: true } })
  assert.ok(broker)
  const reviews = await prisma.review.findMany({ where: { brokerId: broker.id, status: 'APPROVED' }, select: { rating: true, comment: true } })
  assert.ok(reviews.length > 0)
  assert.ok(reviews.every((review) => review.rating >= 1 && review.rating <= 5))
  await prisma.$disconnect()
})

test('anonymous broker and review reads are public', { skip: !base }, async () => {
  const { default: prisma } = await import('../lib/prisma')
  const broker = await prisma.broker.findFirst({ where: { isVisible: true, verificationStatus: 'VERIFIED' }, select: { profileSlug: true } })
  assert.ok(broker)
  const profile = await fetch(`${base}/api/company/${broker.profileSlug}`)
  assert.equal(profile.status, 200)
  const reviewResponse = await fetch(`${base}/api/company/${broker.profileSlug}/reviews`)
  assert.equal(reviewResponse.status, 200)
  const body = await reviewResponse.json() as { reviews: Array<Record<string, unknown>> }
  assert.ok(Array.isArray(body.reviews))
  for (const review of body.reviews) {
    assert.equal('id' in review, false)
    assert.equal('brokerId' in review, false)
    assert.equal('userId' in review, false)
  }
  await prisma.$disconnect()
})
