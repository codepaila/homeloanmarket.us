import assert from 'node:assert/strict'
import test from 'node:test'
import {
  adminCreatedBrokerDefaults,
  normalizeAdminBrokerInput,
  slugifyAdminBroker,
  validateAdminBrokerInput,
} from '../lib/admin-broker'
import { generateClaimToken, hashClaimToken } from '../lib/tokens'
import { isClaimInvitationActive } from '../lib/claim-policy'

test('admin-created broker defaults are unowned, verified, and published', () => {
  assert.deepEqual(adminCreatedBrokerDefaults, {
    creationSource: 'ADMIN_CREATED',
    userId: null,
    verificationStatus: 'VERIFIED',
    brokerStatus: 'FREE',
    isVisible: true,
    subscriptionPlan: 'FREE',
    subscriptionActive: true,
  })
})

test('admin broker input validates required fields without requiring optional contact data', () => {
  const input = normalizeAdminBrokerInput({
    displayName: 'Acme Home Loans',
    description: 'A trusted mortgage advisory profile.',
    phone: '+1 555 123 4567',
    officeAddress: '1 Main Street',
    city: 'Austin',
    state: 'Texas',
    pinCode: '78701',
  })
  assert.deepEqual(validateAdminBrokerInput(input), [])
})

test('admin broker validation rejects malformed required input', () => {
  const input = normalizeAdminBrokerInput({
    displayName: '', description: '', phone: '1', officeAddress: '', city: '', state: '', pinCode: '', website: 'bad-url',
  })
  assert.ok(validateAdminBrokerInput(input).length > 0)
})

test('admin broker slugs are collision-safe inputs', () => {
  assert.equal(slugifyAdminBroker('Acme & Home Loans'), 'acme-home-loans')
  assert.equal(slugifyAdminBroker(''), 'broker')
})

test('claim tokens are random and only their SHA-256 digest is persisted', () => {
  const first = generateClaimToken()
  const second = generateClaimToken()
  assert.notEqual(first, second)
  assert.equal(Buffer.from(first, 'base64url').length, 32)
  assert.equal(hashClaimToken(first).length, 64)
  assert.notEqual(hashClaimToken(first), first)
})

test('expired invitations are not active', () => {
  const now = new Date('2026-01-08T00:00:00.000Z')
  assert.equal(isClaimInvitationActive({ status: 'ACTIVE', expiresAt: new Date('2026-01-09T00:00:00.000Z') }, now), true)
  assert.equal(isClaimInvitationActive({ status: 'ACTIVE', expiresAt: new Date('2026-01-07T23:59:59.000Z') }, now), false)
  assert.equal(isClaimInvitationActive({ status: 'REVOKED', expiresAt: new Date('2026-01-09T00:00:00.000Z') }, now), false)
})
