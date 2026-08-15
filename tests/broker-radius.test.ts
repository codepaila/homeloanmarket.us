import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const geo = fs.readFileSync('lib/location/broker-geo.ts', 'utf8')
const listing = fs.readFileSync('app/(public)/brokers/page.tsx', 'utf8')
const hook = fs.readFileSync('hooks/useClient.ts', 'utf8')
const api = fs.readFileSync('app/api/brokers/route.ts', 'utf8')
const policy = fs.readFileSync('lib/broker-policy.ts', 'utf8')

test('radius is interpreted as miles and converted to meters for spherical geo', () => {
  assert.match(geo, /maxDistance: input\.radiusMiles \* 1609\.344/)
  assert.match(geo, /spherical: true/)
  assert.match(geo, /key: 'location'/)
})

test('geo coordinates use GeoJSON Point with [longitude, latitude] order', () => {
  assert.match(geo, /near: \{ type: 'Point', coordinates: \[input\.longitude, input\.latitude\] \}/)
})

test('radius search filters to public eligibility for non-admin', () => {
  assert.match(geo, /isVisible: true/)
  assert.match(geo, /\{ \$ne: 'SUSPENDED' \}/)
  assert.match(geo, /creationSource: 'ADMIN_CREATED'/)
  assert.match(geo, /verificationStatus: 'VERIFIED'/)
})

test('radius search supports both unowned and active-owner brokers', () => {
  assert.match(geo, /\{ userId: null \}/)
  assert.match(geo, /\{ owner: \{ \$elemMatch: \{ isActive: true \} \} \}/)
})

test('radius pagination is applied inside the geo facet', () => {
  assert.match(geo, /\{ \$skip: input\.take \* \(input\.page - 1\) \}/)
  assert.match(geo, /\{ \$limit: input\.take \}/)
})

test('missing geo index surfaces an actionable message instead of a generic failure', () => {
  assert.match(geo, /unable to find index for \$geoNear/)
  assert.match(geo, /db:ensure-broker-location-index/)
})

test('broker API forwards the actionable radius message and the UI renders it', () => {
  assert.match(api, /Radius search is unavailable/)
  assert.match(listing, /const \{ brokers, total, totalPages, isLoading, error: brokerError \}/)
  assert.match(listing, /Unable to load brokers/)
})

test('radius parameter is synchronized to the broker query and location token', () => {
  assert.match(hook, /queryParams\.append\('radius', String\(radius \|\| 0\)\)/)
  assert.match(hook, /locationToken/)
  assert.match(hook, /queryParams\.append\('latitude'/)
})

test('clearing radius resets to zero and disables the geo branch', () => {
  assert.match(listing, /onRemove=\{\(\) => setRadius\(0\)\}/)
  assert.match(api, /const radius = radiusParam === null \? 0 : Number\(radiusParam\)/)
})

test('radius search is pure geographic and no longer filters by broker attributes', () => {
  assert.doesNotMatch(geo, /match\.serviceCities/)
  assert.doesNotMatch(geo, /match\.specializations/)
  assert.doesNotMatch(geo, /match\.avgRating/)
  assert.doesNotMatch(geo, /match\.experienceYears/)
  assert.doesNotMatch(geo, /match\.languages/)
  assert.doesNotMatch(geo, /featuredOnly/)
  assert.doesNotMatch(geo, /match\.state = regex/)
  assert.doesNotMatch(geo, /match\.pinCode = regex/)
})

test('radius geo input is limited to coordinates, radius, pagination, optional search, and admin', () => {
  assert.doesNotMatch(geo, /city\?: string \| null/)
  assert.doesNotMatch(geo, /specialization\?: string \| null/)
  assert.match(geo, /search\?: string \| null/)
  assert.match(geo, /admin: boolean/)
})

test('radius broker API builds a geographic-only where and keeps public eligibility', () => {
  assert.match(api, /const geoWhere/)
  assert.match(api, /publicBrokerWhere\(\)/)
  assert.match(policy, /isVisible: true/)
  assert.match(policy, /verificationStatus: 'VERIFIED'/)
  assert.match(policy, /brokerStatus: \{ not: 'SUSPENDED' \}/)
  assert.match(policy, /userId: null/)
})

