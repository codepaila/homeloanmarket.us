import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { adminCreatedBrokerDefaults } from '@/lib/admin-broker'
import { isPublicBroker } from '@/lib/broker-policy'

const read = (file: string) => fs.readFileSync(file, 'utf8')

test('admin-created broker defaults are verified and published', () => {
  assert.equal(adminCreatedBrokerDefaults.creationSource, 'ADMIN_CREATED')
  assert.equal(adminCreatedBrokerDefaults.userId, null)
  assert.equal(adminCreatedBrokerDefaults.verificationStatus, 'VERIFIED')
  assert.equal(adminCreatedBrokerDefaults.brokerStatus, 'FREE')
  assert.equal(adminCreatedBrokerDefaults.isVisible, true)
})

test('admin import and manual create set verifiedAt and use the public defaults', () => {
  const importPath = read('lib/admin/broker-data.ts')
  const createRoute = read('app/api/admin/brokers/route.ts')
  assert.match(importPath, /verifiedAt: new Date\(\)/)
  assert.match(importPath, /verificationStatus: adminCreatedBrokerDefaults\.verificationStatus/)
  assert.match(createRoute, /verifiedAt: new Date\(\)/)
  assert.match(createRoute, /isVisible: adminCreatedBrokerDefaults\.isVisible/)
})

test('backfill targets only admin-created unowned non-suspended brokers and is idempotent', () => {
  const backfill = read('scripts/backfill-admin-created-broker-visibility.ts')
  assert.match(backfill, /creationSource: 'ADMIN_CREATED'/)
  assert.match(backfill, /userId: null/)
  assert.match(backfill, /brokerStatus: \{ not: 'SUSPENDED'/)
  assert.match(backfill, /--dry-run/)
  assert.match(backfill, /verifiedAt: new Date\(\)/)
  assert.doesNotMatch(backfill, /deleteMany|broker\.delete\(/)
})

test('public eligibility predicate accepts the admin import default state', () => {
  assert.equal(isPublicBroker({ isVisible: true, verificationStatus: 'VERIFIED', brokerStatus: 'FREE', userId: null }), true)
  assert.equal(isPublicBroker({ isVisible: false, verificationStatus: 'UNVERIFIED', brokerStatus: 'FREE', userId: null }), false)
  assert.equal(isPublicBroker({ isVisible: true, verificationStatus: 'VERIFIED', brokerStatus: 'SUSPENDED', userId: null }), false)
})

test('admin import creates publicly eligible brokers end-to-end', { skip: !process.env.BROKER_IMPORT_TEST_DATABASE_URL }, async () => {
  process.env.DATABASE_URL = process.env.BROKER_IMPORT_TEST_DATABASE_URL!
  const { default: prisma } = await import('../lib/prisma')
  const { importBrokerRows } = await import('../lib/admin/broker-data')
  const rows = [{
    rowNumber: 2,
    values: { displayName: 'Visibility Import Broker', nmls: '9912345', phone: '7135559900', officeAddress: '1 Main Street, Houston, TX 77001', city: 'Houston', state: 'TX', pinCode: '77001' },
    errors: [],
    status: 'NEW' as const,
  }]
  try {
    await prisma.brokerSubscription.deleteMany()
    await prisma.broker.deleteMany()
    const result = await importBrokerRows(rows, 'CREATE_ONLY', '')
    assert.deepEqual({ imported: result.imported, failed: result.failed }, { imported: 1, failed: 0 })
    const broker = await prisma.broker.findFirst({ where: { nmls: '9912345' } })
    assert.ok(broker)
    assert.equal(broker.creationSource, 'ADMIN_CREATED')
    assert.equal(broker.verificationStatus, 'VERIFIED')
    assert.ok(broker.verifiedAt instanceof Date)
    assert.equal(broker.isVisible, true)
    assert.equal(broker.brokerStatus, 'FREE')
    assert.equal(broker.userId, null)
    assert.equal(isPublicBroker({ isVisible: broker.isVisible, verificationStatus: broker.verificationStatus, brokerStatus: broker.brokerStatus, userId: broker.userId }), true)
  } finally {
    await prisma.$disconnect()
  }
})
