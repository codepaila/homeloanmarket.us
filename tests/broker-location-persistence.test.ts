import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {
  buildBrokerAddress,
  isValidLatitude,
  isValidLongitude,
  isValidCoordinatePair,
  locationHasValidCoordinates,
  toBrokerLocationPatch,
} from '@/lib/location/broker-location'

const read = (file: string) => fs.readFileSync(file, 'utf8')

test('coordinate validation rejects NaN, Infinity, and out-of-range values', () => {
  assert.equal(isValidLatitude(29.7604), true)
  assert.equal(isValidLatitude(-90), true)
  assert.equal(isValidLatitude(90), true)
  assert.equal(isValidLatitude(90.1), false)
  assert.equal(isValidLatitude(-90.1), false)
  assert.equal(isValidLatitude(NaN), false)
  assert.equal(isValidLatitude(Infinity), false)
  assert.equal(isValidLongitude(-95.3698), true)
  assert.equal(isValidLongitude(180), true)
  assert.equal(isValidLongitude(180.1), false)
  assert.equal(isValidLongitude(-180.1), false)
  assert.equal(isValidCoordinatePair(29.7604, -95.3698), true)
  assert.equal(isValidCoordinatePair(29.7604, NaN), false)
})

test('buildBrokerAddress joins officeAddress, city, state, and ZIP, dropping blanks', () => {
  assert.equal(buildBrokerAddress({ officeAddress: '123 Main Street', city: 'Houston', state: 'TX', pinCode: '77001' }), '123 Main Street, Houston, TX, 77001')
  assert.equal(buildBrokerAddress({ officeAddress: '123 Main Street', city: null, state: '', pinCode: undefined }), '123 Main Street')
})

test('toBrokerLocationPatch stores GeoJSON [longitude, latitude] and rejects invalid coordinates', () => {
  const patch = toBrokerLocationPatch({ placeId: 'place-1', normalizedAddress: 'Houston, TX, USA', city: 'Houston', state: 'TX', zip: '77001', countryCode: 'US', latitude: 29.7604, longitude: -95.3698 })
  assert.deepEqual(patch?.location, { type: 'Point', coordinates: [-95.3698, 29.7604] })
  assert.equal(patch?.normalizedAddress, 'Houston, TX, USA')
  assert.equal(toBrokerLocationPatch({ placeId: 'p', normalizedAddress: 'x', city: 'x', state: 'x', zip: 'x', countryCode: 'US', latitude: 999, longitude: 0 }), null)
})

test('locationHasValidCoordinates accepts only valid GeoJSON points', () => {
  assert.equal(locationHasValidCoordinates({ type: 'Point', coordinates: [-95.3698, 29.7604] }), true)
  assert.equal(locationHasValidCoordinates({ type: 'Point', coordinates: [29.7604] }), false)
  assert.equal(locationHasValidCoordinates(null), false)
  assert.equal(locationHasValidCoordinates(undefined), false)
})

test('admin creation resolves and persists address coordinates automatically', () => {
  const source = read('app/api/admin/brokers/route.ts')
  assert.match(source, /resolveBrokerLocation/)
  assert.match(source, /normalizedAddress: locationPatch\.normalizedAddress/)
  assert.match(source, /location: locationPatch\.location/)
})

test('admin edit re-resolves coordinates only when the address changes', () => {
  const source = read('app/api/admin/brokers/[id]/route.ts')
  assert.match(source, /addressChanged/)
  assert.match(source, /resolveBrokerLocation/)
  assert.match(source, /Prisma\.DbNull/)
})

test('import geocodes each broker without requiring latitude or longitude columns', () => {
  const source = read('lib/admin/broker-data.ts')
  assert.match(source, /resolveBrokerLocation/)
  assert.match(source, /locationResolved/)
  assert.match(source, /locationFailed/)
  assert.match(source, /mergeLocationPatch/)
  assert.doesNotMatch(source, /latitude.*required|longitude.*required/)
})

test('backfill reports coverage and preserves business fields', () => {
  const source = read('scripts/backfill-broker-locations.ts')
  assert.match(source, /resolveBrokerLocation/)
  assert.match(source, /locationHasValidCoordinates/)
  assert.match(source, /Coverage:/)
  assert.match(source, /Already located/)
  assert.match(source, /Attempted geocoding/)
  assert.doesNotMatch(source, /deleteMany|broker\.delete/)
})

test('broker API no longer dumps full broker arrays to logs', () => {
  const source = read('app/api/brokers/route.ts')
  assert.doesNotMatch(source, /\[PUBLIC BROKERS\]/)
  assert.doesNotMatch(source, /JSON\.stringify\(publicBrokers/)
})
