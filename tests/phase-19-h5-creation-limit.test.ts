import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { assertServiceCityLimit } from '../lib/broker-policy'

const TEST_DIR = path.dirname(new URL(import.meta.url).pathname)
const read = (relative: string): string => fs.readFileSync(path.resolve(TEST_DIR, '..', relative), 'utf8')

const paidFeatured = { plan: 'FEATURED' as const, isActive: true, endDate: null }
const expiredFeatured = { plan: 'FEATURED' as const, isActive: true, endDate: new Date(Date.now() - 1000) }

// =============================================================
// H5 — service-city limit at broker CREATION
// =============================================================

test('H5 create: FREE (null entitlement at creation) allows 1 city', () => {
  const result = assertServiceCityLimit(['Austin'], null)
  assert.equal(result.ok, true)
})

test('H5 create: FREE + 2 cities is rejected', () => {
  const result = assertServiceCityLimit(['Austin', 'Dallas'], null)
  assert.equal(result.ok, false)
  if (!result.ok) assert.match(result.reason, /limited to 1 service city/)
})

test('H5 create: FREE + many cities is rejected', () => {
  const many = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']
  assert.equal(assertServiceCityLimit(many, null).ok, false)
})

test('H5 create: paid FEATURED allows multiple cities', () => {
  const result = assertServiceCityLimit(['Austin', 'Dallas', 'Houston'], paidFeatured)
  assert.equal(result.ok, true)
  assert.equal(result.max, Infinity)
})

test('H5 create: expired paid subscription is treated as FREE', () => {
  const result = assertServiceCityLimit(['Austin', 'Dallas'], expiredFeatured)
  assert.equal(result.ok, false, 'expired paid must collapse to the FREE 1-city allowance')
})

test('H5 create: non-array serviceCities input is not counted (malformed input)', () => {
  assert.equal(assertServiceCityLimit('not-an-array', null).ok, true)
})

test('H5 create: the creation boundary enforces the limit before persistence', () => {
  const source = read('lib/broker-registration.ts')
  assert.ok(source.includes('assertServiceCityLimit(data.serviceCities, null)'), 'creation must check the limit against a null (FREE) entitlement')
  assert.ok(source.includes("error.name = 'ServiceCityLimitError'"), 'creation must raise a named limit error')
})

test('H5 create: the route maps the limit error to 403 SUBSCRIPTION_LIMIT', () => {
  const source = read('app/api/brokers/route.ts')
  assert.ok(source.includes("error?.name === 'ServiceCityLimitError'"), 'route must recognize the limit error')
  assert.ok(source.includes("error: 'SUBSCRIPTION_LIMIT'"), 'route must return the canonical subscription-limit error code')
  assert.ok(source.includes('status: 403'), 'route must return 403')
})

test('H5 create: alternate self-registration path (register/broker) cannot accept serviceCities', () => {
  const inputType = read('lib/broker-registration.ts')
  const typeBlock = inputType.match(/export type BrokerRegistrationInput = \{([^}]*)\}/)
  assert.ok(typeBlock, 'BrokerRegistrationInput type must exist')
  assert.equal(typeBlock[1].includes('serviceCities'), false, 'BrokerRegistrationInput must not accept serviceCities')
  const route = read('app/api/auth/register/broker/route.ts')
  assert.equal(route.includes('serviceCities'), false, 'register/broker route must not accept serviceCities')
})

test('H5 create: admin broker creation remains admin-controlled (not a user bypass)', () => {
  const source = read('app/api/admin/brokers/route.ts')
  assert.ok(source.includes('requireAdmin'), 'admin creation must be admin-gated')
  assert.ok(source.includes("user?.role === 'ADMIN'"), 'admin creation requires the ADMIN role')
})

test('H5 update: PATCH limit behavior remains intact (regression guard)', () => {
  for (const file of ['app/api/brokers/me/route.ts', 'app/api/company/[slug]/route.ts']) {
    const source = read(file)
    assert.ok(source.includes('maxServiceCitiesForEntitlement('), `${file} must keep the update-path entitlement helper`)
  }
})
