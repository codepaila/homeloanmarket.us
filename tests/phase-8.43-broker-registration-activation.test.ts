import assert from 'node:assert/strict'
import test, { mock } from 'node:test'

// ===========================================================================
// PHASE 8.43 runtime — broker registration FEATURED activation email (F1)
//
// finalizeBrokerRegistration must dispatch the durable broker activation email
// after it creates the live BrokerSubscription, so the receipt does not depend
// on whether checkout.session.completed ran before or after finalization.
// ===========================================================================

const dispatches: Array<{ brokerSubscriptionId: string; stripeSubscriptionId?: string | null }> = []
let existingBroker: { id: string } | null = null

const registrationSubscription = {
  plan: 'FEATURED',
  isActive: true,
  status: 'ACTIVE',
  startDate: new Date('2026-01-01'),
  endDate: null,
  stripeCustomerId: 'cus_1',
  stripeSubId: 'sub_A',
}

const registration = {
  id: 'reg-1',
  status: 'ONBOARDING_IN_PROGRESS',
  subscription: registrationSubscription,
  draft: {
    id: 'draft-1',
    data: {
      displayName: 'Jane Originator',
      phone: '5551234567',
      description: 'Experienced mortgage originator serving the local market.',
      nmls: '123456',
      licenseStates: ['TX'],
      location: {
        normalizedAddress: '1 Main St, Dallas, TX 75001',
        city: 'Dallas',
        state: 'TX',
        zip: '75001',
        countryCode: 'US',
        latitude: 32.7767,
        longitude: -96.797,
      },
    },
  },
}

let createCount = 0

const tx = {
  broker: {
    findFirst: async () => existingBroker,
    findUnique: async () => null,
    create: async () => {
      createCount += 1
      return { id: 'broker-1' }
    },
  },
  brokerRegistration: {
    findUnique: async () => registration,
    update: async () => ({}),
  },
  brokerOnboardingDraft: { update: async () => ({}) },
  brokerSubscriptionPlan: { findFirst: async () => ({ id: 'plan-1' }) },
  user: { update: async () => ({}) },
  brokerBank: { createMany: async () => ({}) },
}

const fakePrisma = {
  $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  brokerSubscription: {
    findUnique: async ({ where }: { where: { brokerId: string } }) =>
      where.brokerId === 'broker-1'
        ? { id: 'bsub-1', plan: 'FEATURED', isActive: true, stripeSubId: 'sub_A' }
        : null,
  },
}

mock.module('@/lib/prisma', { exports: { default: fakePrisma } } as never)
mock.module('@/lib/broker-subscription-email', {
  exports: {
    sendBrokerSubscriptionPurchaseEmailDurable: async (brokerSubscriptionId: string, stripeSubscriptionId?: string | null) => {
      dispatches.push({ brokerSubscriptionId, stripeSubscriptionId })
      return { status: 'sent' }
    },
  },
} as never)

test('F1: finalize creates the Broker then dispatches the durable FEATURED activation email', async () => {
  dispatches.length = 0
  createCount = 0
  existingBroker = null
  const { finalizeBrokerRegistration } = await import('../lib/broker-registration')

  const broker = await finalizeBrokerRegistration('user-1')
  await new Promise((r) => setImmediate(r))
  await new Promise((r) => setImmediate(r))

  assert.deepEqual(broker, { id: 'broker-1' })
  assert.equal(createCount, 1)
  assert.equal(dispatches.length, 1, 'exactly one activation dispatch')
  assert.deepEqual(dispatches[0], { brokerSubscriptionId: 'bsub-1', stripeSubscriptionId: 'sub_A' })
})

test('F1: idempotent re-entry (Broker already exists) never re-dispatches', async () => {
  dispatches.length = 0
  createCount = 0
  existingBroker = { id: 'broker-1' }
  const { finalizeBrokerRegistration } = await import('../lib/broker-registration')

  const broker = await finalizeBrokerRegistration('user-1')
  await new Promise((r) => setImmediate(r))

  assert.deepEqual(broker, { id: 'broker-1' })
  assert.equal(createCount, 0, 'no new Broker created')
  assert.equal(dispatches.length, 0, 'no activation email on re-entry')
})
