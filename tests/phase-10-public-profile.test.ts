import assert from 'node:assert/strict'
import test from 'node:test'
import { isPublicBroker } from '../lib/broker-policy'

const verified = {
  isVisible: true,
  verificationStatus: 'VERIFIED' as const,
  brokerStatus: 'FREE' as const,
}

test('approved unowned Broker profiles are publicly eligible without a User', () => {
  assert.equal(isPublicBroker({ ...verified, userId: null }), true)
})

test('suspended, hidden, incomplete, and inactive-owned profiles are not public', () => {
  assert.equal(isPublicBroker({ ...verified, brokerStatus: 'SUSPENDED', userId: null }), false)
  assert.equal(isPublicBroker({ ...verified, isVisible: false, userId: null }), false)
  assert.equal(isPublicBroker({ ...verified, profileComplete: false, userId: null }), false)
  assert.equal(isPublicBroker({ ...verified, userId: 'user-1', userIsActive: false }), false)
})

test('UNVERIFIED visible complete profiles are public (verification is not an eligibility gate)', () => {
  assert.equal(isPublicBroker({ ...verified, verificationStatus: 'UNVERIFIED', creationSource: 'SELF_REGISTERED', userId: null }), true)
})
