import assert from 'node:assert/strict'
import test from 'node:test'
import {
  hasActiveEntitlement,
  hasPaidEntitlement,
  getBrokerContactEmail,
  isBrokerOwner,
  isPublicBroker,
} from '../lib/broker-policy'
import {
  normalizeBrokerRegistrationInput,
  selfRegisteredBrokerDefaults,
  slugifyBrokerName,
  validateBrokerRegistrationInput,
} from '../lib/broker-registration'

const verified = {
  isVisible: true,
  verificationStatus: 'VERIFIED' as const,
  brokerStatus: 'FREE' as const,
}

test('unowned verified broker can be publicly viewed', () => {
  assert.equal(isPublicBroker({ ...verified, userId: null }), true)
})

test('owned verified broker can be publicly viewed when the owner is active', () => {
  assert.equal(isPublicBroker({
    ...verified,
    userId: 'user-1',
    userIsActive: true,
  }), true)
})

test('inactive owner and suspended broker are not public', () => {
  assert.equal(isPublicBroker({
    ...verified,
    userId: 'user-1',
    userIsActive: false,
  }), false)
  assert.equal(isPublicBroker({
    ...verified,
    brokerStatus: 'SUSPENDED',
    userId: null,
  }), false)
})

test('ownership is derived only from Broker.userId', () => {
  assert.equal(isBrokerOwner('user-1', 'user-1'), true)
  assert.equal(isBrokerOwner(null, 'user-1'), false)
  assert.equal(isBrokerOwner('user-2', 'user-1'), false)
})

test('FREE is an active entitlement and paid plans are separate', () => {
  assert.equal(hasActiveEntitlement({ plan: 'FREE', isActive: true }), true)
  assert.equal(hasActiveEntitlement(null), true)
  assert.equal(hasPaidEntitlement({ plan: 'FREE', isActive: true }), false)
  assert.equal(hasPaidEntitlement({ plan: 'FEATURED', isActive: true }), true)
  assert.equal(hasPaidEntitlement({ plan: 'FEATURED', isActive: false }), false)
  assert.equal(hasActiveEntitlement({ plan: 'FEATURED', isActive: true, endDate: new Date(Date.now() - 1) }), false)
  assert.equal(hasPaidEntitlement({ plan: 'FEATURED', isActive: true, endDate: new Date(Date.now() - 1) }), false)
})

test('broker contact email safely handles profile and owner email combinations', () => {
  assert.equal(getBrokerContactEmail({ email: 'profile@example.com', user: { email: 'owner@example.com' } }), 'profile@example.com')
  assert.equal(getBrokerContactEmail({ email: null, user: { email: 'owner@example.com' } }), 'owner@example.com')
  assert.equal(getBrokerContactEmail({ email: 'profile@example.com', user: null }, true), 'profile@example.com')
  assert.equal(getBrokerContactEmail({ email: null, user: null }), null)
})

test('self-registration defaults are server-controlled', () => {
  assert.deepEqual(selfRegisteredBrokerDefaults, {
    role: 'BROKER',
    creationSource: 'SELF_REGISTERED',
    verificationStatus: 'UNVERIFIED',
    brokerStatus: 'FREE',
    isVisible: true,
    subscriptionPlan: 'FREE',
    subscriptionActive: true,
  })
})

test('registration input normalizes and validates required profile data', () => {
  const input = normalizeBrokerRegistrationInput({
    name: '  Jane Doe ',
    companyName: ' Jane Loans ',
    email: ' JANE@EXAMPLE.COM ',
    phone: '+1 (555) 123-4567',
    password: 'Password1',
    description: ' Home loan advice ',
    officeAddress: ' 1 Main Street ',
    city: ' Austin ',
    state: ' Texas ',
    pinCode: ' 78701 ',
  })

  assert.equal(input.email, 'jane@example.com')
  assert.equal(input.companyName, 'Jane Loans')
  assert.deepEqual(validateBrokerRegistrationInput(input), [])
})

test('broker slugs are URL-safe and deterministic', () => {
  assert.equal(slugifyBrokerName('Jane & Sons Home Loans'), 'jane-sons-home-loans')
  assert.equal(slugifyBrokerName(''), 'broker')
})
