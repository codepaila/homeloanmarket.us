import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { issueSearchLocationToken, verifySearchLocationToken } from '../lib/location/search-token'

const read = (path: string) => fs.readFileSync(path, 'utf8')

test('location boundary is server-only and US constrained', () => {
  const service = read('lib/location/google-place.ts')
  const resolveRoute = read('app/api/location/resolve/route.ts')
  const geocodeRoute = read('app/api/location/geocode/route.ts')
  const proxy = read('proxy.ts')
  const broker = read('lib/broker-registration.ts')
  assert.match(service, /GOOGLE_MAPS_SERVER_API_KEY/)
  assert.match(service, /Only US locations are supported/)
  assert.match(broker, /coordinates: \[data\.location\.longitude, data\.location\.latitude\]/)
  assert.match(resolveRoute, /resolveUSPlace/)
  assert.match(resolveRoute, /issueSearchLocationToken/)
  assert.match(geocodeRoute, /geocodeUSAddress/)
  assert.match(proxy, /path\.startsWith\('\/api\/location'\)/)
})

test('radius search uses Mongo geospatial querying and keeps existing filters', () => {
  const geo = read('lib/location/broker-geo.ts')
  const route = read('app/api/brokers/route.ts')
  const listing = read('app/(public)/brokers/page.tsx')
  assert.match(geo, /\$geoNear/)
  assert.match(geo, /2dsphere|distanceField/)
  assert.match(geo, /maxDistance: input\.radiusMiles \* 1609\.344/)
  assert.match(route, /findBrokerIdsWithinRadius/)
  assert.match(route, /radius < 0 \|\| radius > 100/)
  assert.match(route, /verifySearchLocationToken/)
  assert.match(listing, /Enable radius search/)
  assert.match(listing, /max="100"/)
})

test('local advertisements require listing placement and validated target data', () => {
  const schema = read('prisma/schema.prisma')
  const admin = read('app/api/admin/ads/route.ts')
  const publicRoute = read('app/api/ads/public/route.ts')
  const repository = read('lib/advertisements/advertisementRepository.ts')
  const formats = read('lib/advertisements/formats.ts')
  const publicComponent = read('components/advertisements/PublicAdvertisement.tsx')
  assert.match(schema, /BROKER_LISTING_LOCAL/)
  assert.match(schema, /model AdvertisementLocationTarget/)
  assert.match(admin, /resolveAdvertisementTarget/)
  assert.match(admin, /local broker-listing ads/)
  assert.match(publicRoute, /BROKER_LISTING_LOCAL/)
  assert.match(publicRoute, /verifySearchLocationToken/)
  assert.match(repository, /distanceMiles/)
  assert.match(formats, /BROKER_LISTING_LOCAL: \['SQUARE'\]/)
  assert.match(publicComponent, /grid-cols-1.*sm:grid-cols-2.*lg:grid-cols-3/)
})

test('search location tokens prevent arbitrary coordinate injection', () => {
  process.env.AUTH_SECRET = 'location-token-test-secret'
  const location = {
    normalizedAddress: 'Dallas, TX, USA',
    city: 'Dallas',
    state: 'TX',
    zip: '75201',
    countryCode: 'US' as const,
    latitude: 32.7767,
    longitude: -96.797,
  }
  const token = issueSearchLocationToken(location)
  const verified = verifySearchLocationToken(token)
  assert.deepEqual({ ...verified, exp: undefined }, { ...location, exp: undefined })
  assert.throws(() => verifySearchLocationToken(`${token.slice(0, -1)}x`))
})
