import assert from 'node:assert/strict'
import test, { after } from 'node:test'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const database = process.env.BROKER_RADIUS_TEST_DATABASE_URL

async function mongosh(script: string) {
  if (!database) throw new Error('BROKER_RADIUS_TEST_DATABASE_URL is required')
  const result = await execFileAsync('mongosh', ['--quiet', database, '--eval', script])
  return result.stdout
}

function point(longitude: number, latitude: number) {
  return { type: 'Point', coordinates: [longitude, latitude] }
}

after(async () => {
  if (database) await mongosh('db.dropDatabase()')
})

test('radius returns eligible unowned and claimed brokers and excludes ineligible ones', { skip: !database }, async () => {
  await mongosh(`
    db.dropDatabase();
    db.brokers.createIndex({ location: '2dsphere' }, { name: 'brokers_location_2dsphere' });
    const owner = ObjectId();
    db.users.insertOne({ _id: owner, email: 'owner@example.test', isActive: true, role: 'BROKER' });
    const inactiveOwner = ObjectId();
    db.users.insertOne({ _id: inactiveOwner, email: 'inactive@example.test', isActive: false, role: 'BROKER' });
    db.brokers.insertMany([
      { displayName: 'Visible Unowned', profileSlug: 'v-unowned', userId: null, creationSource: 'ADMIN_CREATED', description: 'x', phone: '7135550101', officeAddress: 'a', city: 'Houston', state: 'TX', pinCode: '77009', verificationStatus: 'VERIFIED', brokerStatus: 'FREE', isVisible: true, location: ${JSON.stringify(point(-95.3698, 29.7604))} },
      { displayName: 'Visible Claimed', profileSlug: 'v-claimed', userId: owner, creationSource: 'ADMIN_CREATED', description: 'x', phone: '7135550102', officeAddress: 'b', city: 'Houston', state: 'TX', pinCode: '77009', verificationStatus: 'VERIFIED', brokerStatus: 'FREE', isVisible: true, location: ${JSON.stringify(point(-95.40, 29.78))} },
      { displayName: 'Hidden', profileSlug: 'hidden', userId: null, description: 'x', phone: '7135550103', officeAddress: 'c', city: 'Houston', state: 'TX', pinCode: '77009', verificationStatus: 'VERIFIED', brokerStatus: 'FREE', isVisible: false, location: ${JSON.stringify(point(-95.3698, 29.7604))} },
      { displayName: 'Unverified', profileSlug: 'unverified', userId: null, description: 'x', phone: '7135550104', officeAddress: 'd', city: 'Houston', state: 'TX', pinCode: '77009', verificationStatus: 'UNVERIFIED', brokerStatus: 'FREE', isVisible: true, location: ${JSON.stringify(point(-95.3698, 29.7604))} },
      { displayName: 'Suspended', profileSlug: 'suspended', userId: null, description: 'x', phone: '7135550105', officeAddress: 'e', city: 'Houston', state: 'TX', pinCode: '77009', verificationStatus: 'VERIFIED', brokerStatus: 'SUSPENDED', isVisible: true, location: ${JSON.stringify(point(-95.3698, 29.7604))} },
      { displayName: 'Inactive Owner', profileSlug: 'inactive-owner', userId: inactiveOwner, description: 'x', phone: '7135550106', officeAddress: 'f', city: 'Houston', state: 'TX', pinCode: '77009', verificationStatus: 'VERIFIED', brokerStatus: 'FREE', isVisible: true, location: ${JSON.stringify(point(-95.3698, 29.7604))} },
      { displayName: 'Out of Radius', profileSlug: 'far', userId: null, description: 'x', phone: '7135550107', officeAddress: 'g', city: 'Dallas', state: 'TX', pinCode: '75201', verificationStatus: 'VERIFIED', brokerStatus: 'FREE', isVisible: true, location: ${JSON.stringify(point(-96.7969, 32.7767))} }
    ]);
  `)
  process.env.DATABASE_URL = database!
  const { findBrokerIdsWithinRadius } = await import('../lib/location/broker-geo')
  const result = await findBrokerIdsWithinRadius({ latitude: 29.7604, longitude: -95.3698, radiusMiles: 50, page: 1, take: 12, admin: false })
  assert.equal(result.total, 2)
  assert.equal(result.ids.length, 2)
})

test('radius returns zero results when no eligible broker has coordinates nearby', { skip: !database }, async () => {
  await mongosh(`db.dropDatabase(); db.brokers.createIndex({ location: '2dsphere' }, { name: 'brokers_location_2dsphere' });`)
  process.env.DATABASE_URL = database!
  const { findBrokerIdsWithinRadius } = await import('../lib/location/broker-geo')
  const result = await findBrokerIdsWithinRadius({ latitude: 29.7604, longitude: -95.3698, radiusMiles: 50, page: 1, take: 12, admin: false })
  assert.equal(result.total, 0)
  assert.deepEqual(result.ids, [])
})

test('radius without the geo index throws an actionable error', { skip: !database }, async () => {
  await mongosh(`db.dropDatabase(); db.brokers.insertOne({ displayName: 'x', profileSlug: 'no-index', userId: null, description: 'x', phone: '1', officeAddress: 'x', city: 'Houston', state: 'TX', pinCode: '77009', verificationStatus: 'VERIFIED', brokerStatus: 'FREE', isVisible: true, location: ${JSON.stringify(point(-95.3698, 29.7604))} });`)
  process.env.DATABASE_URL = database!
  const { findBrokerIdsWithinRadius } = await import('../lib/location/broker-geo')
  await assert.rejects(
    findBrokerIdsWithinRadius({ latitude: 29.7604, longitude: -95.3698, radiusMiles: 25, page: 1, take: 12, admin: false }),
    /Radius search is unavailable because the Broker location index is missing/,
  )
})
