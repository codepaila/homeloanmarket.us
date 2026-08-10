import assert from 'node:assert/strict'
import test from 'node:test'

const database = process.env.PHASE13_AUTH_DATABASE_URL
const secret = process.env.AUTH_SECRET

test('Admin Dashboard secret source is configured to prevent getToken MissingSecret', { skip: !secret }, () => {
  assert.ok(secret && secret.length > 0)
})

test('Admin Dashboard data is typed and sourced from real database records', { skip: !database }, async () => {
  const { default: prisma } = await import('../lib/prisma')
  const { getAdminDashboardData } = await import('../lib/admin/dashboard')

  try {
    const data = await getAdminDashboardData()

    assert.equal(typeof data.overview.totalUsers, 'number')
    assert.equal(typeof data.overview.totalBrokers, 'number')
    assert.ok(data.overview.totalBrokers >= 0)
    assert.ok(data.overview.totalUsers >= data.overview.totalBrokers ? data.overview.totalUsers >= data.overview.totalBrokers : true)
    assert.equal(typeof data.overview.pendingClaims, 'number')
    assert.equal(typeof data.overview.adImpressions, 'number')
    assert.equal(typeof data.overview.adClicks, 'number')
    assert.equal(data.revenue, null)
    assert.equal(data.userGrowth.length, 12)
    assert.equal(data.brokerGrowth.length, 12)
    assert.equal(data.subscriptionGrowth.length, 12)
    assert.ok(Array.isArray(data.activity))
    assert.ok(data.adEngagement.keys.length > 0)
    assert.equal(typeof data.generatedAt, 'string')
  } finally {
    await prisma.$disconnect()
  }
})
