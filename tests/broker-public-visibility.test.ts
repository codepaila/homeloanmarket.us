import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { isPublicBroker, BROKER_ADMIN_FIELDS, BROKER_EDITABLE_FIELDS, pickBrokerEditableFields } from '@/lib/broker-policy'

const read = (file: string) => fs.readFileSync(file, 'utf8')
const publicBroker = {
  isVisible: true,
  verificationStatus: 'VERIFIED' as const,
  brokerStatus: 'FREE' as const,
  userId: null,
}

test('visible active unowned brokers are publicly eligible regardless of verification', () => {
  assert.equal(isPublicBroker(publicBroker), true)
  assert.equal(isPublicBroker({ ...publicBroker, creationSource: 'SELF_REGISTERED', verificationStatus: 'UNVERIFIED' }), true)
})

test('hidden, suspended, incomplete, and company-owned brokers are not publicly eligible', () => {
  assert.equal(isPublicBroker({ ...publicBroker, isVisible: false }), false)
  assert.equal(isPublicBroker({ ...publicBroker, brokerStatus: 'SUSPENDED' }), false)
  assert.equal(isPublicBroker({ ...publicBroker, profileComplete: false }), false)
  assert.equal(isPublicBroker({ ...publicBroker, userId: 'owner', userIsActive: true, hasActiveCompanyMembership: true }), false)
})

test('owned public brokers still require an active, non-company owner account', () => {
  assert.equal(isPublicBroker({ ...publicBroker, userId: 'owner', userIsActive: true }), true)
  assert.equal(isPublicBroker({ ...publicBroker, userId: 'owner', userIsActive: false }), false)
})

test('visibility is admin-only and cannot be mass-assigned by broker users', () => {
  const picked = pickBrokerEditableFields({ displayName: 'Updated', isVisible: true }, false)
  assert.equal(picked.displayName, 'Updated')
  assert.equal(picked.isVisible, undefined)
  assert.equal((BROKER_EDITABLE_FIELDS as readonly string[]).includes('isVisible'), false)
  assert.equal((BROKER_ADMIN_FIELDS as readonly string[]).includes('isVisible'), true)
})

test('public and radius queries preserve the same unowned visibility and completeness rule', () => {
  const publicApi = read('app/api/brokers/route.ts')
  const listingQuery = read('lib/broker-listing.ts')
  const geoQuery = read('lib/location/broker-geo.ts')
  assert.match(publicApi, /publicBrokerWhere\(\)|getPublicListingPage/)
  assert.match(listingQuery, /isVisible: true/)
  assert.match(listingQuery, /\{ userId: null \}/)
  assert.match(listingQuery, /\$ne: 'SUSPENDED'/)
  assert.match(listingQuery, /profileSlug: \{ \$nin: \[null, ''\] \}/)
  assert.match(geoQuery, /conditions\.push\(\{ isVisible: true \}\)/)
  assert.match(geoQuery, /\{ userId: null \}/)
  assert.match(geoQuery, /\$nin: \[null, ''\]/)
})

test('admin mutation and claim completion preserve the same Broker record', () => {
  const adminRoute = read('app/api/admin/brokers/[id]/route.ts')
  const claimCompletion = read('lib/claim-completion.ts')
  assert.match(adminRoute, /admin\?\.role !== 'ADMIN'/)
  assert.match(adminRoute, /'isVisible'/)
  assert.match(claimCompletion, /broker\.updateMany\(\{ where: \{ id: currentInvitation\.claim\.brokerId, userId: null \}/)
  assert.equal(claimCompletion.includes('broker.create'), false)
  assert.equal(claimCompletion.includes('isVisible:'), false)
})

test('admin/import defaults are verified and published by default', () => {
  const defaults = read('lib/admin-broker.ts')
  const importPath = read('lib/admin/broker-data.ts')
  assert.match(defaults, /isVisible: true/)
  assert.match(defaults, /verificationStatus: 'VERIFIED'/)
  assert.match(importPath, /adminCreatedBrokerDefaults\.isVisible/)
  assert.match(importPath, /isVisible: adminCreatedBrokerDefaults\.isVisible/)
  assert.match(importPath, /verifiedAt: new Date\(\)/)
})
