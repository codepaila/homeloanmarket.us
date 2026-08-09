import assert from 'node:assert/strict'
import test from 'node:test'
import { classifyClaimUser } from '../lib/claim-flow'

const base = { isActive: true, emailVerified: true, password: 'hash', brokerProfile: null, accounts: [] }

test('claim account classification supports the finalized claimant cases', () => {
  assert.equal(classifyClaimUser({ ...base, role: 'USER' }), 'EXISTING_USER')
  assert.equal(classifyClaimUser({ ...base, role: 'BROKER' }), 'BROKER_AVAILABLE')
  assert.equal(classifyClaimUser({ ...base, role: 'ADMIN' }), 'ADMIN')
  assert.equal(classifyClaimUser({ ...base, role: 'USER', isActive: false }), 'INACTIVE')
  assert.equal(classifyClaimUser({ ...base, role: 'USER', password: null, accounts: [{ provider: 'google' }] }), 'GOOGLE_ONLY')
  assert.equal(classifyClaimUser({ ...base, role: 'BROKER', brokerProfile: { id: 'existing' } }), 'BROKER_WITH_PROFILE')
})
