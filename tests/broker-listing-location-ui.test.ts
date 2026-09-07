import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const listing = fs.readFileSync('app/(public)/brokers/page.tsx', 'utf8')
const adminActions = fs.readFileSync('app/admin/brokers/[id]/AdminBrokerActions.tsx', 'utf8')
const locationRoute = fs.readFileSync('app/api/admin/brokers/[id]/location/route.ts', 'utf8')
const publicApi = fs.readFileSync('app/api/brokers/route.ts', 'utf8')
const listingLib = fs.readFileSync('lib/broker-listing.ts', 'utf8')

test('selected location is not counted or rendered as a duplicate filter chip', () => {
  assert.match(listing, /const hasActiveFilters = Boolean\(search \|\| radius > 0/)
  assert.doesNotMatch(listing, /selectedLocation && 'location'/)
  assert.doesNotMatch(listing, /label=\{`Location: \$\{selectedLocation\.normalizedAddress\}`\}/)
  assert.match(listing, /radiusEnabled \? radius : 0/)
})

test('location selection keeps search state canonical and clearable', () => {
  assert.match(listing, /selectedLocation\?\.normalizedAddress === searchInput\.trim\(\)/)
  assert.match(listing, /setSelectedLocation\(null\)/)
  assert.match(listing, /setRadius\(0\)/)
  assert.match(listing, /locationToken/)
})

test('admin review exposes explicit verification, publication, and location resolution', () => {
  assert.match(adminActions, /Mark profile verified after review/)
  assert.match(adminActions, /Publish profile after review/)
  assert.match(adminActions, /Resolve Location/)
  assert.match(locationRoute, /geocodeUSAddress\(broker\.officeAddress\)/)
  assert.match(locationRoute, /type: 'Point'/)
})

test('public listing preserves visibility, status, and completeness gates and drops the verification gate', () => {
  assert.match(publicApi, /getPublicListingPage/)
  assert.match(listingLib, /isVisible: true/)
  assert.match(listingLib, /\$ne: 'SUSPENDED'/)
  assert.match(listingLib, /profileSlug: \{ \$nin: \[null, ''\] \}/)
  assert.doesNotMatch(listingLib, /verificationStatus: 'VERIFIED'/)
  assert.doesNotMatch(listingLib, /creationSource: 'ADMIN_CREATED'/)
})
