import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const api = fs.readFileSync('app/api/brokers/route.ts', 'utf8')
const geo = fs.readFileSync('lib/location/broker-geo.ts', 'utf8')
const hook = fs.readFileSync('hooks/useClient.ts', 'utf8')
const policy = fs.readFileSync('lib/broker-policy.ts', 'utf8')

test('broker API no longer uses serviceCities for search or location filtering', () => {
  assert.doesNotMatch(api, /where\.serviceCities/)
  assert.doesNotMatch(api, /serviceCities = \{ has:/)
})

test('radius geo pipeline does not use serviceCities', () => {
  assert.doesNotMatch(geo, /serviceCities/)
})

test('normal listing does not auto-apply serviceCities from a city or location param', () => {
  assert.doesNotMatch(api, /serviceCities = \{ has: city \}/)
  assert.doesNotMatch(api, /serviceCities = \{ has: locationCity/)
})

test('text search still covers address/location fields', () => {
  assert.match(api, /officeAddress: \{ contains: term, mode: 'insensitive' \}/)
  assert.match(api, /city: \{ contains: term, mode: 'insensitive' \}/)
  assert.match(api, /state: \{ contains: term, mode: 'insensitive' \}/)
  assert.match(api, /pinCode: \{ contains: term, mode: 'insensitive' \}/)
})

test('public eligibility remains enforced for anonymous listing', () => {
  assert.match(api, /publicBrokerWhere\(\)/)
  assert.match(policy, /isVisible: true/)
  assert.match(policy, /verificationStatus: 'VERIFIED'/)
  assert.match(policy, /brokerStatus: \{ not: 'SUSPENDED' \}/)
  assert.match(policy, /\{ userId: null \}/)
  assert.match(policy, /creationSource: 'ADMIN_CREATED'/)
})

test('broker query hook does not map city to serviceCities', () => {
  assert.doesNotMatch(hook, /serviceCities/)
})
