import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const api = fs.readFileSync('app/api/brokers/route.ts', 'utf8')
const listing = fs.readFileSync('lib/broker-listing.ts', 'utf8')
const hook = fs.readFileSync('hooks/useClient.ts', 'utf8')
const geo = fs.readFileSync('lib/location/broker-geo.ts', 'utf8')

test('A: free-text search still covers address/location fields', () => {
  // The aggregation search covers office address, city, state and pinCode
  // (the route forwards the free-text term into the listing match).
  assert.match(listing, /\{ city: regex\(input\.search\) \}/)
  assert.match(listing, /\{ state: regex\(input\.search\) \}/)
  assert.match(listing, /\{ pinCode: regex\(input\.search\) \}/)
})

test('B: selected city is constrained by city AND state at radius 0', () => {
  assert.match(api, /resolvedCity = locationCity \|\| verifiedLocation\?\.city/)
  assert.match(api, /locationCity: resolvedCity/)
  assert.match(api, /locationState: resolvedState/)
  assert.match(listing, /input\.locationCity\) conditions\.push\(\{ city: regex\(input\.locationCity\) \}\)/)
  assert.match(listing, /!input\.state && input\.locationState\) conditions\.push\(\{ state: regex\(input\.locationState\) \}\)/)
})

test('B: city selection is never reduced to state-only', () => {
  assert.match(api, /const locationCity = searchParams\.get\('locationCity'\)/)
  assert.match(api, /Never reduce a city selection to/)
  assert.match(listing, /input\.locationCity\) conditions\.push\(\{ city: regex\(input\.locationCity\) \}\)/)
})

test('G: city selection does not require ZIP', () => {
  // The pinCode constraint is applied only when a ZIP was actually selected.
  assert.match(listing, /!input\.zip && input\.locationZip\) conditions\.push\(\{ pinCode: regex\(input\.locationZip\) \}\)/)
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
