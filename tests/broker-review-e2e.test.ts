import assert from 'node:assert/strict'
import test from 'node:test'
import prisma from '../lib/prisma'
import { recalculateBrokerRating } from '../lib/reviews'

const suffix = () => Date.now() + '-' + Math.floor(Math.random() * 1e6)

async function makeBroker(tag: string) {
  const user = await prisma.user.create({ data: { name: 'Broker Owner', email: 'broker' + tag + '@example.com', role: 'USER', isActive: true } })
  const broker = await prisma.broker.create({
    data: {
      displayName: 'Audit Broker ' + tag,
      description: 'desc',
      profileSlug: 'audit-broker-' + tag,
      phone: '+1',
      officeAddress: '123 Main, Houston, TX 77001',
      city: 'Houston',
      state: 'TX',
      pinCode: '77001',
      avgRating: 0,
      totalReviews: 0,
      userId: user.id,
      isVisible: true,
    },
  })
  return { user, broker }
}

test('a submitted review is PENDING and does not affect the public rating', async () => {
  const tag = suffix()
  let reviewerId: string | undefined, ownerId: string | undefined, brokerId: string | undefined
  try {
    const reviewer = await prisma.user.create({ data: { name: 'Reviewer', email: 'rev' + tag + '@example.com', role: 'USER', isActive: true } })
    reviewerId = reviewer.id
    const { user, broker } = await makeBroker(tag)
    ownerId = user.id
    brokerId = broker.id

    const review = await prisma.review.create({ data: { brokerId: broker.id, userId: reviewer.id, rating: 4, comment: 'Great service overall.', status: 'PENDING' } })
    assert.equal(review.status, 'PENDING', 'new review must start PENDING')

    // Pending reviews are not public and do not count toward the rating.
    const publicCount = await prisma.review.count({ where: { brokerId: broker.id, status: 'APPROVED' } })
    assert.equal(publicCount, 0)
    const { avgRating, totalReviews } = await recalculateBrokerRating(broker.id)
    assert.equal(avgRating, 0)
    assert.equal(totalReviews, 0)
  } finally {
    if (brokerId) await prisma.review.deleteMany({ where: { brokerId } })
    if (brokerId) await prisma.broker.deleteMany({ where: { id: brokerId } })
    if (ownerId) await prisma.user.deleteMany({ where: { id: ownerId } })
    if (reviewerId) await prisma.user.deleteMany({ where: { id: reviewerId } })
  }
})

test('approving a review publishes it and recomputes the broker rating/count', async () => {
  const tag = suffix()
  let reviewerId: string | undefined, ownerId: string | undefined, brokerId: string | undefined
  try {
    const reviewer = await prisma.user.create({ data: { name: 'Reviewer', email: 'revapp' + tag + '@example.com', role: 'USER', isActive: true } })
    reviewerId = reviewer.id
    const { user, broker } = await makeBroker(tag)
    ownerId = user.id
    brokerId = broker.id

    await prisma.review.create({ data: { brokerId: broker.id, userId: reviewer.id, rating: 4, comment: 'Great service.', status: 'PENDING' } })
    // Admin approves (mirrors PATCH /api/admin/reviews/[id] action=approve).
    await prisma.review.updateMany({ where: { brokerId: broker.id }, data: { status: 'APPROVED' } })
    const { avgRating, totalReviews } = await recalculateBrokerRating(broker.id)
    assert.equal(avgRating, 4)
    assert.equal(totalReviews, 1)
    assert.equal(await prisma.review.count({ where: { brokerId: broker.id, status: 'APPROVED' } }), 1)
  } finally {
    if (brokerId) await prisma.review.deleteMany({ where: { brokerId } })
    if (brokerId) await prisma.broker.deleteMany({ where: { id: brokerId } })
    if (ownerId) await prisma.user.deleteMany({ where: { id: ownerId } })
    if (reviewerId) await prisma.user.deleteMany({ where: { id: reviewerId } })
  }
})

test('rejecting a review excludes it from the public rating/count', async () => {
  const tag = suffix()
  let reviewerId: string | undefined, ownerId: string | undefined, brokerId: string | undefined
  try {
    const reviewer = await prisma.user.create({ data: { name: 'Reviewer', email: 'revrej' + tag + '@example.com', role: 'USER', isActive: true } })
    reviewerId = reviewer.id
    const { user, broker } = await makeBroker(tag)
    ownerId = user.id
    brokerId = broker.id

    await prisma.review.create({ data: { brokerId: broker.id, userId: reviewer.id, rating: 1, comment: 'Poor experience.', status: 'PENDING' } })
    await prisma.review.updateMany({ where: { brokerId: broker.id }, data: { status: 'REJECTED' } })
    const { avgRating, totalReviews } = await recalculateBrokerRating(broker.id)
    assert.equal(avgRating, 0)
    assert.equal(totalReviews, 0)
    assert.equal(await prisma.review.count({ where: { brokerId: broker.id, status: 'APPROVED' } }), 0)
  } finally {
    if (brokerId) await prisma.review.deleteMany({ where: { brokerId } })
    if (brokerId) await prisma.broker.deleteMany({ where: { id: brokerId } })
    if (ownerId) await prisma.user.deleteMany({ where: { id: ownerId } })
    if (reviewerId) await prisma.user.deleteMany({ where: { id: reviewerId } })
  }
})

test('duplicate review policy: one pending/approved review per user per broker; rejected may resubmit', async () => {
  const tag = suffix()
  let reviewerId: string | undefined, ownerId: string | undefined, brokerId: string | undefined
  try {
    const reviewer = await prisma.user.create({ data: { name: 'Reviewer', email: 'revdup' + tag + '@example.com', role: 'USER', isActive: true } })
    reviewerId = reviewer.id
    const { user, broker } = await makeBroker(tag)
    ownerId = user.id
    brokerId = broker.id

    await prisma.review.create({ data: { brokerId: broker.id, userId: reviewer.id, rating: 5, comment: 'First review', status: 'APPROVED' } })
    const duplicate = await prisma.review.findFirst({ where: { brokerId: broker.id, userId: reviewer.id, status: { in: ['PENDING', 'APPROVED'] } } })
    assert.ok(duplicate, 'an active review must block a duplicate')

    // Rejected reviews do NOT block resubmission.
    await prisma.review.updateMany({ where: { brokerId: broker.id, userId: reviewer.id }, data: { status: 'REJECTED' } })
    const canResubmit = await prisma.review.findFirst({ where: { brokerId: broker.id, userId: reviewer.id, status: { in: ['PENDING', 'APPROVED'] } } })
    assert.equal(canResubmit, null, 'rejected review must allow resubmission')
  } finally {
    if (brokerId) await prisma.review.deleteMany({ where: { brokerId } })
    if (brokerId) await prisma.broker.deleteMany({ where: { id: brokerId } })
    if (ownerId) await prisma.user.deleteMany({ where: { id: ownerId } })
    if (reviewerId) await prisma.user.deleteMany({ where: { id: reviewerId } })
  }
})
