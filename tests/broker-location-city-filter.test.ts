import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const api = fs.readFileSync('app/api/brokers/route.ts', 'utf8')
const hook = fs.readFileSync('hooks/useClient.ts', 'utf8')
const geo = fs.readFileSync('lib/location/broker-geo.ts', 'utf8')

test('A: free-text search still covers address/location fields', () => {
  assert.match(api, /city: \{ contains: term, mode: 'insensitive' \}/)
  assert.match(api, /state: \{ contains: term, mode: 'insensitive' \}/)
  assert.match(api, /pinCode: \{ contains: term, mode: 'insensitive' \}/)
})

test('B: selected city is constrained by city AND state at radius 0', () => {
  assert.match(api, /const resolvedCity = locationCity \|\| verifiedLocation\?\.city/)
  assert.match(api, /if \(resolvedCity\) where\.city = \{ contains: resolvedCity, mode: 'insensitive' \}/)
  assert.match(api, /where\.state = \{ contains: resolvedState, mode: 'insensitive' \}/)
})

test('B: city selection is never reduced to state-only', () => {
  assert.match(api, /const locationCity = searchParams\.get\('locationCity'\)/)
  assert.match(api, /Never reduce a city selection to/)
  assert.match(api, /if \(resolvedCity\) where\.city/)
})

test('G: city selection does not require ZIP', () => {
  assert.match(api, /if \(!zip && resolvedZip\) where\.pinCode/)
})

test('C/D: radius search still uses the geo engine, not string matching', () => {
  assert.match(api, /findBrokerIdsWithinRadius/)
  assert.match(geo, /\$geoNear/)
  assert.match(geo, /key: 'location'/)
})

test('I/K: coordinates require a server-validated location token', () => {
  assert.match(api, /A server-validated search location is required/)
  assert.match(api, /verifySearchLocationToken\(locationToken\)/)
  assert.match(api, /Invalid or expired search location/)
})

test('M/N: public broker search never depends on serviceCities', () => {
  assert.doesNotMatch(api, /where\.serviceCities/)
  assert.doesNotMatch(api, /serviceCities = \{ has:/)
  assert.doesNotMatch(geo, /match\.serviceCities/)
  assert.doesNotMatch(hook, /serviceCities/)
})

test('frontend sends the structured locationCity to the API', () => {
  assert.match(hook, /if \(location\.city\) queryParams\.append\('locationCity', location\.city\)/)
})
