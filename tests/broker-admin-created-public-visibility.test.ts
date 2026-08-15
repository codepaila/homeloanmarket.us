import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { isPublicBroker, publicBrokerWhere } from '@/lib/broker-policy'

const geo = fs.readFileSync('lib/location/broker-geo.ts', 'utf8')
const api = fs.readFileSync('app/api/brokers/route.ts', 'utf8')

test('A: ADMIN_CREATED unowned non-suspended broker is public regardless of verification', () => {
  assert.equal(isPublicBroker({
    isVisible: true,
    verificationStatus: 'UNVERIFIED',
    brokerStatus: 'FREE',
    creationSource: 'ADMIN_CREATED',
    userId: null,
  }), true)
})

test('B: ADMIN_CREATED unowned suspended broker is not public', () => {
  assert.equal(isPublicBroker({
    isVisible: true,
    verificationStatus: 'VERIFIED',
    brokerStatus: 'SUSPENDED',
    creationSource: 'ADMIN_CREATED',
    userId: null,
  }), false)
})

test('C: ADMIN_CREATED broker with an active owner is public', () => {
  assert.equal(isPublicBroker({
    isVisible: true,
    verificationStatus: 'UNVERIFIED',
    brokerStatus: 'FREE',
    creationSource: 'ADMIN_CREATED',
    userId: 'user-1',
    userIsActive: true,
  }), true)
})

test('D: ADMIN_CREATED broker with an inactive owner follows ownership policy', () => {
  assert.equal(isPublicBroker({
    isVisible: true,
    verificationStatus: 'VERIFIED',
    brokerStatus: 'FREE',
    creationSource: 'ADMIN_CREATED',
    userId: 'user-1',
    userIsActive: false,
  }), false)
})

test('E: SELF_REGISTERED VERIFIED visible active broker is public', () => {
  assert.equal(isPublicBroker({
    isVisible: true,
    verificationStatus: 'VERIFIED',
    brokerStatus: 'FREE',
    creationSource: 'SELF_REGISTERED',
    userId: 'user-1',
    userIsActive: true,
  }), true)
})

test('F: SELF_REGISTERED UNVERIFIED broker is not public', () => {
  assert.equal(isPublicBroker({
    isVisible: true,
    verificationStatus: 'UNVERIFIED',
    brokerStatus: 'FREE',
    creationSource: 'SELF_REGISTERED',
    userId: 'user-1',
    userIsActive: true,
  }), false)
})

test('G: SELF_REGISTERED hidden broker is not public', () => {
  assert.equal(isPublicBroker({
    isVisible: false,
    verificationStatus: 'VERIFIED',
    brokerStatus: 'FREE',
    creationSource: 'SELF_REGISTERED',
    userId: null,
  }), false)
})

test('H: SELF_REGISTERED suspended broker is not public', () => {
  assert.equal(isPublicBroker({
    isVisible: true,
    verificationStatus: 'VERIFIED',
    brokerStatus: 'SUSPENDED',
    creationSource: 'SELF_REGISTERED',
    userId: null,
  }), false)
})

test('I: ADMIN_CREATED eligibility never requires serviceCities', () => {
  const where = publicBrokerWhere()
  const serialized = JSON.stringify(where)
  assert.doesNotMatch(serialized, /serviceCities/)
  assert.doesNotMatch(serialized, /specializations/)
  assert.doesNotMatch(serialized, /languages/)
  assert.equal(isPublicBroker({
    isVisible: true,
    verificationStatus: 'UNVERIFIED',
    brokerStatus: 'FREE',
    creationSource: 'ADMIN_CREATED',
    userId: null,
  }), true)
})

test('publicBrokerWhere exposes ADMIN_CREATED and SELF_REGISTERED branches with shared protections', () => {
  const where = publicBrokerWhere() as {
    isVisible: boolean
    brokerStatus: { not: string }
    AND: Array<{ OR: Array<Record<string, unknown>> }>
  }
  assert.equal(where.isVisible, true)
  assert.deepEqual(where.brokerStatus, { not: 'SUSPENDED' })
  const conditions = JSON.stringify(where.AND)
  assert.match(conditions, /creationSource.*ADMIN_CREATED/)
  assert.match(conditions, /verificationStatus.*VERIFIED/)
  assert.match(conditions, /userId.*null/)
  assert.match(conditions, /isActive.*true/)
})

test('radius baseMatch uses the ADMIN_CREATED branch and no legacy eligibility attributes', () => {
  assert.match(geo, /creationSource: 'ADMIN_CREATED'/)
  assert.match(geo, /verificationStatus: 'VERIFIED'/)
  assert.doesNotMatch(geo, /serviceCities/)
  assert.doesNotMatch(geo, /specializations/)
  assert.doesNotMatch(geo, /languages/)
})

test('normal listing delegates to the shared publicBrokerWhere helper', () => {
  assert.match(api, /publicBrokerWhere\(\)/)
})
