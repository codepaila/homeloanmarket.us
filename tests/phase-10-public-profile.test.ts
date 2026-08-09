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

test('suspended, hidden, unverified, and inactive-owned profiles are not public', () => {
  assert.equal(isPublicBroker({ ...verified, brokerStatus: 'SUSPENDED', userId: null }), false)
  assert.equal(isPublicBroker({ ...verified, isVisible: false, userId: null }), false)
  assert.equal(isPublicBroker({ ...verified, verificationStatus: 'UNVERIFIED', userId: null }), false)
  assert.equal(isPublicBroker({ ...verified, userId: 'user-1', userIsActive: false }), false)
})
