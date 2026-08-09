import assert from 'node:assert/strict'
import test from 'node:test'
import { postLoginRedirect, roleHome } from '../lib/auth-redirect'

const database = process.env.PHASE13_AUTH_DATABASE_URL

test.after(async () => {
  if (database) {
    const { default: prisma } = await import('../lib/prisma')
    await prisma.$disconnect()
  }
})

test('Admin role routing targets the canonical /admin dashboard', () => {
  assert.equal(roleHome('ADMIN'), '/admin')
  assert.equal(postLoginRedirect('ADMIN'), '/admin')
  assert.equal(postLoginRedirect('BROKER'), '/broker/dashboard')
  assert.equal(postLoginRedirect('USER'), '/')
})

test('Dashboard KPI aggregation returns real platform values', { skip: !database }, async () => {
  const { default: prisma } = await import('../lib/prisma')
  const { getAdminDashboardData } = await import('../lib/admin/dashboard')
  try {
    const data = await getAdminDashboardData()
    assert.equal(typeof data.overview.totalUsers, 'number')
    assert.equal(typeof data.overview.totalBrokers, 'number')
    assert.equal(typeof data.overview.activeBrokers, 'number')
    assert.equal(data.overview.totalUsers, 18)
    assert.equal(data.overview.totalBrokers, 8)
    assert.ok(data.overview.totalUsers >= 0)
    assert.ok(data.overview.totalBrokers >= 0)
    assert.ok(data.overview.totalProfileViews >= 0)
    assert.ok(data.overview.activeSubscriptions >= 0)
    assert.ok(data.overview.freeSubscriptions >= 0)
    assert.ok(data.overview.featuredSubscriptions >= 0)
    assert.equal(data.overview.activeSubscriptions >= data.overview.featuredSubscriptions, true)
  } finally {
    await prisma.$disconnect()
  }
})

test('Platform and subscription growth return real monthly buckets', { skip: !database }, async () => {
  const { default: prisma } = await import('../lib/prisma')
  const { getAdminDashboardData } = await import('../lib/admin/dashboard')
  try {
    const data = await getAdminDashboardData()
    assert.equal(data.userGrowth.length, 12)
    assert.equal(data.brokerGrowth.length, 12)
    assert.equal(data.subscriptionGrowth.length, 12)
    assert.equal(data.featuredGrowth.length, 12)
    assert.ok(data.userGrowth.some((point) => point.value > 0))
    assert.ok(data.brokerGrowth.some((point) => point.value > 0))
  } finally {
    await prisma.$disconnect()
  }
})

test('Profile views render actual counters and top brokers', { skip: !database }, async () => {
  const { default: prisma } = await import('../lib/prisma')
  const { getAdminDashboardData } = await import('../lib/admin/dashboard')
  try {
    const data = await getAdminDashboardData()
    assert.equal(typeof data.profileViews.total, 'number')
    assert.ok(data.profileViews.total >= 0)
    assert.ok(Array.isArray(data.profileViews.top))
    for (const broker of data.profileViews.top) {
      assert.equal(typeof broker.slug, 'string')
      assert.equal(typeof broker.views, 'number')
      assert.ok(broker.views >= 0)
    }
  } finally {
    await prisma.$disconnect()
  }
})

test('Advertisement analytics and top advertisements come from AdEvents', { skip: !database }, async () => {
  const { default: prisma } = await import('../lib/prisma')
  const { getAdminDashboardData } = await import('../lib/admin/dashboard')
  try {
    const data = await getAdminDashboardData()
    assert.ok(data.adEngagement.totalImpressions >= 0)
    assert.ok(data.adEngagement.totalClicks >= 0)
    assert.ok(data.adEngagement.totalClicks <= data.adEngagement.totalImpressions)
    assert.ok(Array.isArray(data.topAdvertisements))
    for (const advertisement of data.topAdvertisements) {
      assert.equal(typeof advertisement.title, 'string')
      assert.ok(advertisement.impressions >= 0)
      assert.ok(advertisement.clicks <= advertisement.impressions)
    }
  } finally {
    await prisma.$disconnect()
  }
})

test('Operational monitoring returns bounded recent panels', { skip: !database }, async () => {
  const { default: prisma } = await import('../lib/prisma')
  const { getAdminDashboardData } = await import('../lib/admin/dashboard')
  try {
    const data = await getAdminDashboardData()
    assert.ok(data.recent.users.length <= 10)
    assert.ok(data.recent.brokers.length <= 10)
    assert.ok(data.recent.contacts.length <= 10)
    assert.ok(data.recent.claims.length <= 10)
    assert.ok(data.recent.advertisements.length <= 10)
    assert.ok(Array.isArray(data.activity))
  } finally {
    await prisma.$disconnect()
  }
})

test('Dashboard DTO does not serialize private fields', { skip: !database }, async () => {
  const { default: prisma } = await import('../lib/prisma')
  const { getAdminDashboardData } = await import('../lib/admin/dashboard')
  try {
    const data = await getAdminDashboardData()
    const serialized = JSON.stringify(data)
    assert.equal(serialized.includes('"password"'), false)
    assert.equal(serialized.includes('"passwordHash"'), false)
    assert.equal(serialized.includes('"token"'), false)
    assert.equal(serialized.includes('"secret"'), false)
    assert.equal(serialized.includes('stripeCustomerId'), false)
  } finally {
    await prisma.$disconnect()
  }
})

test('Dashboard handles empty datasets without NaN or negative values', { skip: !database }, async () => {
  const { default: prisma } = await import('../lib/prisma')
  const { getAdminDashboardData } = await import('../lib/admin/dashboard')
  try {
    const data = await getAdminDashboardData()
    const serialized = JSON.stringify(data)
    assert.equal(serialized.includes('NaN'), false)
    assert.equal(serialized.includes('Infinity'), false)
    const numericValues = Object.values(data.overview)
    for (const value of numericValues) {
      if (typeof value === 'number') assert.ok(value >= 0)
    }
    for (const point of [...data.userGrowth, ...data.brokerGrowth, ...data.subscriptionGrowth, ...data.featuredGrowth]) {
      assert.ok(point.value >= 0)
    }
  } finally {
    await prisma.$disconnect()
  }
})
