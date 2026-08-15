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

const HOUSTON = { latitude: 29.7604, longitude: -95.3698 }

after(async () => {
  if (database) await mongosh('db.dropDatabase()')
})

test('serviceCities does not determine radius eligibility', { skip: !database }, async () => {
  await mongosh(`
    db.dropDatabase();
    db.brokers.createIndex({ location: '2dsphere' }, { name: 'brokers_location_2dsphere' });
    db.brokers.insertMany([
      { displayName: 'Empty Service Cities', profileSlug: 'empty-sc', userId: null, description: 'x', phone: '7135550201', officeAddress: '1 Main St', city: 'Houston', state: 'TX', pinCode: '77009', verificationStatus: 'VERIFIED', brokerStatus: 'FREE', isVisible: true, serviceCities: [], location: ${JSON.stringify(point(-95.3698, 29.7604))} },
      { displayName: 'Wrong Service City', profileSlug: 'wrong-sc', userId: null, description: 'x', phone: '7135550202', officeAddress: '2 Main St', city: 'Houston', state: 'TX', pinCode: '77009', verificationStatus: 'VERIFIED', brokerStatus: 'FREE', isVisible: true, serviceCities: ['Dallas'], location: ${JSON.stringify(point(-95.37, 29.761))} },
      { displayName: 'No Service Cities Field', profileSlug: 'no-sc', userId: null, description: 'x', phone: '7135550203', officeAddress: '3 Main St', city: 'Houston', state: 'TX', pinCode: '77009', verificationStatus: 'VERIFIED', brokerStatus: 'FREE', isVisible: true, location: ${JSON.stringify(point(-95.369, 29.76))} },
      { displayName: 'Houston Service City But Far', profileSlug: 'far-sc', userId: null, description: 'x', phone: '7135550204', officeAddress: '100 Dallas St', city: 'Dallas', state: 'TX', pinCode: '75201', verificationStatus: 'VERIFIED', brokerStatus: 'FREE', isVisible: true, serviceCities: ['Houston'], location: ${JSON.stringify(point(-96.7969, 32.7767))} }
    ]);
  `)
  process.env.DATABASE_URL = database!
  const { findBrokerIdsWithinRadius } = await import('../lib/location/broker-geo')

  const result = await findBrokerIdsWithinRadius({ latitude: HOUSTON.latitude, longitude: HOUSTON.longitude, radiusMiles: 10, page: 1, take: 50, admin: false })
  const names = await import('@prisma/client').then(async ({ PrismaClient }) => {
    const prisma = new PrismaClient()
    const brokers = await prisma.broker.findMany({ where: { id: { in: result.ids } }, select: { displayName: true } })
    await prisma.$disconnect()
    return brokers.map((b) => b.displayName)
  })

  // Geographic truth: all three Houston-located brokers appear regardless of serviceCities.
  assert.ok(names.includes('Empty Service Cities'))
  assert.ok(names.includes('Wrong Service City'))
  assert.ok(names.includes('No Service Cities Field'))
  // The broker with serviceCities=['Houston'] but a Dallas location must NOT appear.
  assert.equal(names.includes('Houston Service City But Far'), false)
  assert.equal(result.total, 3)
})

test('monotonic radius never reduces the geographic candidate set', { skip: !database }, async () => {
  await mongosh(`
    db.dropDatabase();
    db.brokers.createIndex({ location: '2dsphere' }, { name: 'brokers_location_2dsphere' });
    db.brokers.insertMany([
      { displayName: 'Half', profileSlug: 'm-half', userId: null, description: 'x', phone: '1', officeAddress: 'a', city: 'Houston', state: 'TX', pinCode: '77009', verificationStatus: 'VERIFIED', brokerStatus: 'FREE', isVisible: true, serviceCities: [], location: ${JSON.stringify(point(-95.3698, 29.7676))} },
      { displayName: 'Three', profileSlug: 'm-three', userId: null, description: 'x', phone: '2', officeAddress: 'b', city: 'Houston', state: 'TX', pinCode: '77009', verificationStatus: 'VERIFIED', brokerStatus: 'FREE', isVisible: true, serviceCities: [], location: ${JSON.stringify(point(-95.3698, 29.8039))} },
      { displayName: 'Ten', profileSlug: 'm-ten', userId: null, description: 'x', phone: '3', officeAddress: 'c', city: 'Houston', state: 'TX', pinCode: '77009', verificationStatus: 'VERIFIED', brokerStatus: 'FREE', isVisible: true, serviceCities: [], location: ${JSON.stringify(point(-95.3698, 29.9053))} },
      { displayName: 'TwentyFive', profileSlug: 'm-25', userId: null, description: 'x', phone: '4', officeAddress: 'd', city: 'Houston', state: 'TX', pinCode: '77009', verificationStatus: 'VERIFIED', brokerStatus: 'FREE', isVisible: true, serviceCities: [], location: ${JSON.stringify(point(-95.3698, 30.1227))} },
      { displayName: 'Fifty', profileSlug: 'm-50', userId: null, description: 'x', phone: '5', officeAddress: 'e', city: 'Houston', state: 'TX', pinCode: '77009', verificationStatus: 'VERIFIED', brokerStatus: 'FREE', isVisible: true, serviceCities: [], location: ${JSON.stringify(point(-95.3698, 30.4850))} }
    ]);
  `)
  process.env.DATABASE_URL = database!
  const { findBrokerIdsWithinRadius } = await import('../lib/location/broker-geo')
  const counts: number[] = []
  for (const radius of [1, 3, 10, 25, 50]) {
    const result = await findBrokerIdsWithinRadius({ latitude: HOUSTON.latitude, longitude: HOUSTON.longitude, radiusMiles: radius, page: 1, take: 50, admin: false })
    counts.push(result.total)
  }
  for (let i = 1; i < counts.length; i++) {
    assert.ok(counts[i] >= counts[i - 1], `radius ${counts[i - 1]} -> ${counts[i]} must be monotonic`)
  }
})
