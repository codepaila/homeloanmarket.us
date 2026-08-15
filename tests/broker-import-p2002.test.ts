import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

test('import implementation preflights the actual nullable ownership index', () => {
  const source = fs.readFileSync('lib/admin/broker-data.ts', 'utf8')
  assert.match(source, /aggregate: 'brokers'/)
  assert.match(source, /\$indexStats/)
  assert.match(source, /partialFilterExpression/)
  assert.match(source, /Unknown tagged-value|tagged-value|BSON tagged-value|tagged value/i)
  assert.match(source, /Run yarn db:ensure-ownership-index/)
})

test('import modes retain explicit create, update, and upsert behavior', () => {
  const source = fs.readFileSync('lib/admin/broker-data.ts', 'utf8')
  assert.match(source, /mode === 'CREATE_ONLY'/)
  assert.match(source, /mode === 'UPDATE_ONLY'/)
  assert.match(source, /mode === 'UPSERT'/)
  assert.match(source, /IMPORT_NOT_FOUND/)
  assert.match(source, /Broker became a duplicate after preview/)
})

test('actual Mongo import lifecycle runs twice when a disposable integration URL is supplied', { skip: !process.env.BROKER_IMPORT_TEST_DATABASE_URL }, async () => {
  process.env.DATABASE_URL = process.env.BROKER_IMPORT_TEST_DATABASE_URL!
  const { default: prisma } = await import('../lib/prisma')
  const { annotateBrokerImportRows, importBrokerRows } = await import('../lib/admin/broker-data')
  const rows = [1, 2].map((index) => ({
    rowNumber: index + 1,
    values: { displayName: `Import Broker ${index}`, nmls: `99000${index}`, phone: `71355500${String(index).padStart(2, '0')}`, officeAddress: `${index} Main Street`, companyName: `Import Company ${index}`, email: `import-broker-${index}@example.test`, state: 'TX', pinCode: '77001' },
    errors: [],
    status: 'NEW' as const,
  }))
  try {
    await prisma.brokerSubscription.deleteMany()
    await prisma.broker.deleteMany()
    const preview = await annotateBrokerImportRows(rows)
    assert.equal(preview.filter((row) => row.status === 'NEW').length, 2)
    const first = await importBrokerRows(preview, 'CREATE_ONLY', '')
    assert.deepEqual({ imported: first.imported, failed: first.failed }, { imported: 2, failed: 0 })
    const secondPreview = await annotateBrokerImportRows(rows)
    assert.equal(secondPreview.filter((row) => row.status === 'EXISTING').length, 2)
    const second = await importBrokerRows(secondPreview, 'CREATE_ONLY', '')
    assert.deepEqual({ imported: second.imported, skipped: second.skipped, failed: second.failed }, { imported: 0, skipped: 2, failed: 0 })
  } finally {
    await prisma.$disconnect()
  }
})

test('partial ownership index metadata does not trigger Prisma tagged-value deserialization', { skip: !process.env.BROKER_IMPORT_PARTIAL_INDEX_DATABASE_URL }, async () => {
  process.env.DATABASE_URL = process.env.BROKER_IMPORT_PARTIAL_INDEX_DATABASE_URL!
  const { annotateBrokerImportRows } = await import('../lib/admin/broker-data')
  const rows = [{ rowNumber: 2, values: { displayName: 'Partial Index Broker', nmls: '8800999', phone: '7135551199', officeAddress: '1 Main Street, Houston, TX 77001' }, errors: [], status: 'NEW' as const }]
  const preview = await annotateBrokerImportRows(rows)
  assert.equal(preview[0].status, 'NEW')
})
