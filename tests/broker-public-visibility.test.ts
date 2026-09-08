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

// ===========================================================================
// PHASE 8.36.1 — source-aware verification gate
//
// SELF_REGISTERED brokers must be admin VERIFIED before they are publicly
// eligible. ADMIN_CREATED brokers are verified by construction and stay
// eligible. Verification is an ELIGIBILITY gate, never a ranking tier, and
// never changes isVisible.
// ===========================================================================

test('visible active unowned ADMIN_CREATED brokers are publicly eligible (no manual verification step)', () => {
  assert.equal(isPublicBroker({ ...publicBroker, creationSource: 'ADMIN_CREATED' }), true)
  // Legacy records with no known source must still be VERIFIED to be public.
  assert.equal(isPublicBroker(publicBroker), true)
})

test('SELF_REGISTERED + UNVERIFIED is NOT publicly eligible', () => {
  assert.equal(isPublicBroker({ ...publicBroker, creationSource: 'SELF_REGISTERED', verificationStatus: 'UNVERIFIED' }), false)
})

test('SELF_REGISTERED + VERIFIED is publicly eligible (when otherwise eligible)', () => {
  assert.equal(isPublicBroker({ ...publicBroker, creationSource: 'SELF_REGISTERED', verificationStatus: 'VERIFIED' }), true)
})

test('isVisible=false prevents public listing even after verification', () => {
  assert.equal(isPublicBroker({ ...publicBroker, creationSource: 'SELF_REGISTERED', verificationStatus: 'VERIFIED', isVisible: false }), false)
  assert.equal(isPublicBroker({ ...publicBroker, creationSource: 'ADMIN_CREATED', isVisible: false }), false)
})

test('SUSPENDED brokers are never publicly eligible regardless of verification', () => {
  assert.equal(isPublicBroker({ ...publicBroker, creationSource: 'SELF_REGISTERED', verificationStatus: 'VERIFIED', brokerStatus: 'SUSPENDED' }), false)
  assert.equal(isPublicBroker({ ...publicBroker, creationSource: 'ADMIN_CREATED', brokerStatus: 'SUSPENDED' }), false)
})

test('hidden, incomplete, and company-owned brokers are not publicly eligible', () => {
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

test('verification is NOT a ranking tier (ranking stays tier 1-4, all eligible)', () => {
  const listing = read('lib/broker-listing.ts')
  assert.match(listing, /1\s*=\s*paid active subscription/)
  assert.match(listing, /4\s*=\s*no qualifying signal/)
  // Tier is rank-only: no $match on tier.
  assert.match(listing, /No \$match on `tier`/)
})

test('public, radius, featured, and sitemap queries all include the source-aware verification gate', () => {
  const listingQuery = read('lib/broker-listing.ts')
  const geoQuery = read('lib/location/broker-geo.ts')
  const featured = read('app/api/brokers/featured/route.ts')
  const policy = read('lib/broker-policy.ts')
  // Canonical predicate requires ADMIN_CREATED OR VERIFIED.
  assert.match(policy, /state\.creationSource === 'ADMIN_CREATED' \|\| state\.verificationStatus === 'VERIFIED'/)
  assert.match(policy, /OR: \[\s*\{ creationSource: 'ADMIN_CREATED' \},\s*\{ verificationStatus: 'VERIFIED' \},\s*\]/)
  // Listing + radius mirrors.
  assert.match(listingQuery, /creationSource: 'ADMIN_CREATED'/)
  assert.match(listingQuery, /verificationStatus: 'VERIFIED'/)
  assert.match(geoQuery, /creationSource: 'ADMIN_CREATED'/)
  assert.match(geoQuery, /verificationStatus: 'VERIFIED'/)
  // Featured route.
  assert.match(featured, /creationSource: 'ADMIN_CREATED'/)
  assert.match(featured, /verificationStatus: 'VERIFIED'/)
})

test('public broker profile page passes creationSource to the canonical predicate', () => {
  const profile = read('app/(public)/brokers/[slug]/page.tsx')
  assert.match(profile, /creationSource: broker\.creationSource/)
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