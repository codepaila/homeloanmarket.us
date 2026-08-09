import assert from 'node:assert/strict'
import test from 'node:test'
import type Stripe from 'stripe'
import { getStripeEventTarget } from '../app/api/stripe/webhook/route'

function event(type: string, object: Record<string, unknown>): Stripe.Event {
  return {
    id: 'evt_test',
    object: 'event',
    api_version: null,
    created: 100,
    data: { object } as Stripe.Event.Data,
    livemode: false,
    pending_webhooks: 1,
    request: null,
    type,
  } as Stripe.Event
}

test('subscription webhook targets use the subscription object id for ordering', () => {
  assert.deepEqual(
    getStripeEventTarget(event('customer.subscription.updated', { id: 'sub_123', customer: 'cus_123' })),
    { customerId: 'cus_123', subscriptionId: 'sub_123' },
  )
})

test('invoice and checkout webhook targets use nested subscription ids', () => {
  assert.deepEqual(
    getStripeEventTarget(event('invoice.payment_succeeded', { customer: 'cus_123', subscription: 'sub_123' })),
    { customerId: 'cus_123', subscriptionId: 'sub_123' },
  )
  assert.deepEqual(
    getStripeEventTarget(event('checkout.session.completed', { customer: 'cus_123', subscription: 'sub_123' })),
    { customerId: 'cus_123', subscriptionId: 'sub_123' },
  )
})
