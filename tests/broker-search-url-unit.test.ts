import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_RADIUS_MILES,
  buildBrokerSearchUrl,
  parseResolvedLocation,
} from '../lib/search'

const HOUSTON = {
  normalizedAddress: 'Houston, TX, USA',
  city: 'Houston',
  state: 'TX',
  zip: '77001',
  countryCode: 'US' as const,
  latitude: 29.7604,
  longitude: -95.3698,
  token: 'signed-token',
}

test('buildBrokerSearchUrl activates radius with the default 25 miles for a confirmed location', () => {
  const url = buildBrokerSearchUrl(HOUSTON, '')
  assert.match(url, /^\/brokers\?/)
  assert.match(url, /location=Houston%2C\+TX%2C\+USA/)
  assert.match(url, /radius=25/)
  assert.match(url, /latitude=29\.7604/)
  assert.match(url, /longitude=-95\.3698/)
  assert.match(url, /locationToken=signed-token/)
  assert.match(url, /locationCity=Houston/)
  assert.match(url, /locationState=TX/)
})

test('buildBrokerSearchUrl preserves an explicit radius', () => {
  const url = buildBrokerSearchUrl(HOUSTON, '', 50)
  assert.match(url, /radius=50/)
})

test('buildBrokerSearchUrl treats free text as a plain search with no radius', () => {
  const url = buildBrokerSearchUrl(null, 'Houston, TX')
  assert.match(url, /search=Houston/)
  assert.doesNotMatch(url, /radius=/)
  assert.doesNotMatch(url, /latitude=/)
})

test('DEFAULT_RADIUS_MILES is 25', () => {
  assert.equal(DEFAULT_RADIUS_MILES, 25)
})

test('parseResolvedLocation restores a confirmed location from coordinates', () => {
  const params = new URLSearchParams({
    location: 'Houston, TX, USA',
    locationCity: 'Houston',
    locationState: 'TX',
    locationZip: '77001',
    latitude: '29.7604',
    longitude: '-95.3698',
    locationToken: 'signed-token',
  })
  const location = parseResolvedLocation(params)
  assert.ok(location)
  assert.equal(location.normalizedAddress, 'Houston, TX, USA')
  assert.equal(location.latitude, 29.7604)
  assert.equal(location.longitude, -95.3698)
  assert.equal(location.token, 'signed-token')
})

test('parseResolvedLocation returns null when coordinates are missing (manual text is not confirmed)', () => {
  const params = new URLSearchParams({ location: 'Houston, TX' })
  assert.equal(parseResolvedLocation(params), null)
})

test('parseResolvedLocation returns null for malformed coordinates', () => {
  const params = new URLSearchParams({ location: 'Houston, TX', latitude: 'abc', longitude: '-95.36' })
  assert.equal(parseResolvedLocation(params), null)
})
