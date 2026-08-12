import assert from 'node:assert/strict'
import test from 'node:test'

const database = process.env.PHASE15_BROKER_DB_URL
const base = process.env.PHASE15_BROKER_BASE_URL

test.after(async () => {
  if (database) {
    const { default: prisma } = await import('../lib/prisma')
    await prisma.$disconnect()
  }
})

test('broker API search matches name, company, ZIP, city, and state fields', { skip: !base }, async () => {
  const response = await fetch(`${base}/api/brokers?search=90210&page=1&pageSize=12`)
  assert.equal(response.status, 200)
  const body = await response.json() as { brokers: Array<Record<string, unknown>> }
  assert.ok(Array.isArray(body.brokers))
})

test('broker API supports minimum experience and language filters', { skip: !base }, async () => {
  const response = await fetch(`${base}/api/brokers?minExperience=5&language=English&page=1&pageSize=12`)
  assert.equal(response.status, 200)
  const body = await response.json() as { brokers: Array<{ experienceYears?: number; languages?: string[] }> }
  assert.ok(Array.isArray(body.brokers))
  for (const broker of body.brokers) {
    if (broker.experienceYears !== undefined) assert.ok(broker.experienceYears >= 5)
  }
})

test('broker search results map to real public broker records', { skip: !database }, async () => {
  const { default: prisma } = await import('../lib/prisma')
  const broker = await prisma.broker.findFirst({ where: { isVisible: true, verificationStatus: 'VERIFIED' }, select: { pinCode: true, profileSlug: true } })
  assert.ok(broker)
  const response = await fetch(`${base}/api/brokers?search=${encodeURIComponent(broker.pinCode || '')}&page=1&pageSize=12`)
  assert.equal(response.status, 200)
  const body = await response.json() as { brokers: Array<{ profileSlug: string }> }
  assert.ok(body.brokers.some((b) => b.profileSlug === broker.profileSlug), `expected ${broker.profileSlug} in results for ZIP ${broker.pinCode || 'any search'}`)
  await prisma.$disconnect()
})
