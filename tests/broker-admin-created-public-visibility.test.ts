import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { isPublicBroker, publicBrokerWhere } from '@/lib/broker-policy'

const geo = fs.readFileSync('lib/location/broker-geo.ts', 'utf8')
const api = fs.readFileSync('app/api/brokers/route.ts', 'utf8')

const adminBroker = {
  isVisible: true,
  verificationStatus: 'UNVERIFIED' as const,
  brokerStatus: 'FREE' as const,
  creationSource: 'ADMIN_CREATED' as const,
  userId: null,
}

test('A: ADMIN_CREATED unowned non-suspended broker is public regardless of verification', () => {
  assert.equal(isPublicBroker(adminBroker), true)
})

test('B: ADMIN_CREATED unowned suspended broker is not public', () => {
  assert.equal(isPublicBroker({ ...adminBroker, verificationStatus: 'VERIFIED', brokerStatus: 'SUSPENDED' }), false)
})

test('C: ADMIN_CREATED broker with an active owner is public', () => {
  assert.equal(isPublicBroker({ ...adminBroker, userId: 'user-1', userIsActive: true }), true)
})

test('D: ADMIN_CREATED broker with an inactive owner follows ownership policy', () => {
  assert.equal(isPublicBroker({ ...adminBroker, verificationStatus: 'VERIFIED', userId: 'user-1', userIsActive: false }), false)
})

test('E: SELF_REGISTERED VERIFIED visible active broker is public', () => {
  assert.equal(isPublicBroker({
    isVisible: true,
    verificationStatus: 'VERIFIED',
    brokerStatus: 'FREE',
    creationSource: 'SELF_REGISTERED',
    userId: 'user-1',
    userIsActive: true,
  }), true)
})

test('F: SELF_REGISTERED UNVERIFIED complete visible broker is public', () => {
  // Core Phase 8.28.1 correction: verification is not a public eligibility
  // requirement. A self-registered broker with a complete, published profile is
  // public even while UNVERIFIED. The gate must be profile completeness.
  assert.equal(isPublicBroker({
    isVisible: true,
    verificationStatus: 'UNVERIFIED',
    brokerStatus: 'FREE',
    creationSource: 'SELF_REGISTERED',
    userId: 'user-1',
    userIsActive: true,
    profileComplete: true,
  }), true)
})

test('F2: SELF_REGISTERED UNVERIFIED incomplete broker is not public', () => {
  assert.equal(isPublicBroker({
    isVisible: true,
    verificationStatus: 'VERIFIED',
    brokerStatus: 'FREE',
    creationSource: 'SELF_REGISTERED',
    userId: 'user-1',
    userIsActive: true,
    profileComplete: false,
  }), false)
})

test('G: SELF_REGISTERED hidden broker is not public', () => {
  assert.equal(isPublicBroker({
    isVisible: false,
    verificationStatus: 'VERIFIED',
    brokerStatus: 'FREE',
    creationSource: 'SELF_REGISTERED',
    userId: null,
  }), false)
})

test('H: SELF_REGISTERED suspended broker is not public', () => {
  assert.equal(isPublicBroker({
    isVisible: true,
    verificationStatus: 'VERIFIED',
    brokerStatus: 'SUSPENDED',
    creationSource: 'SELF_REGISTERED',
    userId: null,
  }), false)
})

test('I: public eligibility never requires serviceCities, specializations, or languages', () => {
  const where = publicBrokerWhere()
  const serialized = JSON.stringify(where)
  assert.doesNotMatch(serialized, /serviceCities/)
  assert.doesNotMatch(serialized, /specializations/)
  assert.doesNotMatch(serialized, /languages/)
  assert.equal(isPublicBroker(adminBroker), true)
})

test('publicBrokerWhere applies completeness and shared ownership protections without verification or source', () => {
  const where = publicBrokerWhere() as {
    isVisible: boolean
    brokerStatus: { not: string }
    displayName: { not: string }
    description: { not: string }
    phone: { not: string }
    officeAddress: { not: string }
    profileSlug: { not: string }
    AND: Array<{ OR: Array<Record<string, unknown>> }>
  }
  assert.equal(where.isVisible, true)
  assert.deepEqual(where.brokerStatus, { not: 'SUSPENDED' })
  assert.deepEqual(where.displayName, { not: '' })
  assert.deepEqual(where.description, { not: '' })
  assert.deepEqual(where.phone, { not: '' })
  assert.deepEqual(where.officeAddress, { not: '' })
  assert.deepEqual(where.profileSlug, { not: '' })
  const conditions = JSON.stringify(where.AND)
  assert.doesNotMatch(conditions, /creationSource/)
  assert.doesNotMatch(conditions, /verificationStatus/)
  assert.match(conditions, /"userId":null/)
  assert.match(conditions, /"isActive":true/)
})

test('radius baseMatch applies completeness and no legacy eligibility attributes', () => {
  assert.match(geo, /displayName: \{ \$nin: \[null, ''\] \}/)
  assert.match(geo, /profileSlug: \{ \$nin: \[null, ''\] \}/)
  assert.doesNotMatch(geo, /serviceCities/)
  assert.doesNotMatch(geo, /specializations/)
  assert.doesNotMatch(geo, /languages/)
  assert.doesNotMatch(geo, /creationSource: 'ADMIN_CREATED'/)
  assert.doesNotMatch(geo, /verificationStatus: 'VERIFIED'/)
})

test('normal listing delegates to the shared public listing pipeline', () => {
  assert.match(api, /getPublicListingPage/)
})