import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')

const api = read('app/api/brokers/route.ts')
const listing = read('lib/broker-listing.ts')
const geo = read('lib/location/broker-geo.ts')
const utils = read('utils/index.ts')

test('paid/subscribed brokers are ordered first via live entitlement, not the enum string', () => {
  // The listing aggregation computes the paid tier live from the subscription
  // (FEATURED + active + not expired) before any other tie-breaker.
  assert.match(listing, /\$sort: \{ tier: 1/)
  assert.match(listing, /featuredRank: -1/)
  assert.doesNotMatch(listing, /brokerStatus: -1/)
  assert.doesNotMatch(api, /brokerStatus: 'desc'/)
})

test('ordering keeps a stable unique id tiebreaker', () => {
  assert.match(listing, /_id: 1/)
})

test('radius geo sort also orders featured brokers first via live entitlement', () => {
  assert.match(geo, /\$sort: \{ tier: 1/)
  assert.match(geo, /featuredRank: -1/)
  assert.doesNotMatch(geo, /brokerStatus: -1/)
})

test('public broker listing page size is exactly 15', () => {
  assert.match(utils, /TABLE_ROW_PAGE = 15/)
  assert.match(utils, /PAGE_SIZE = 15/)
})

test('featured ordering is applied before pagination (sort precedes skip/limit)', () => {
  const listingSource = listing.slice(listing.indexOf('$sort'), listing.indexOf('cursor: {}'))
  const sortIdx = listingSource.indexOf('$sort')
  const skipIdx = listingSource.indexOf('$skip')
  const limitIdx = listingSource.indexOf('$limit')
  assert.ok(sortIdx > -1, 'aggregation contains $sort')
  assert.ok(skipIdx > -1, 'aggregation contains $skip')
  assert.ok(limitIdx > -1, 'aggregation contains $limit')
  assert.ok(sortIdx < skipIdx && sortIdx < limitIdx, '$sort precedes $skip/$limit so pagination is server-side and correct')
})

test('expired subscriptions never produce the paid ordering tier', () => {
  // The live entitlement flag requires endDate to be null OR in the future.
  assert.match(listing, /\$gt: \['\$\$s\.endDate'/)
})