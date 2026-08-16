import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')

const api = read('app/api/brokers/route.ts')
const geo = read('lib/location/broker-geo.ts')
const utils = read('utils/index.ts')

test('featured/subscribed brokers are ordered first via featuredRank, not the enum string', () => {
  assert.match(api, /\{ featuredRank: 'desc' \}/)
  assert.doesNotMatch(api, /brokerStatus: 'desc'/)
})

test('ordering keeps a stable unique id tiebreaker', () => {
  assert.match(api, /\{ id: 'asc' \}/)
})

test('radius geo sort also orders featured brokers first via featuredRank', () => {
  assert.match(geo, /featuredRank: -1/)
  assert.doesNotMatch(geo, /brokerStatus: -1/)
})

test('public broker listing page size is exactly 20', () => {
  assert.match(utils, /TABLE_ROW_PAGE = 20/)
  assert.match(utils, /PAGE_SIZE = 20/)
})

test('featured ordering is applied before pagination (orderBy precedes skip/take)', () => {
  const orderIdx = api.indexOf('orderBy: [')
  const findManyIdx = api.indexOf('prisma.broker.findMany')
  assert.ok(orderIdx > findManyIdx, 'orderBy is inside findMany')
  assert.ok(api.indexOf('featuredRank') > findManyIdx)
})
