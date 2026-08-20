import assert from 'node:assert/strict'
import test, { after, before } from 'node:test'
import { PrismaClient, StripeWebhookEventStatus } from '@prisma/client'
import { stripePriceIds, validatePlanPrice } from '../lib/stripe'
import { SubscriptionService } from '../lib/subscription'
import { validateBrokerPlanForCheckout } from '../lib/broker-plans'

const prisma = new PrismaClient()
const prefix = `phase81-${Date.now()}`
const eventIds: string[] = []
const brokerIds: string[] = []

before(() => prisma.$connect())
after(async () => {
  if (eventIds.length) await prisma.stripeWebhookEvent.deleteMany({ where: { eventId: { in: eventIds } } })
  if (brokerIds.length) await prisma.brokerSubscription.deleteMany({ where: { brokerId: { in: brokerIds } } })
  if (brokerIds.length) await prisma.broker.deleteMany({ where: { id: { in: brokerIds } } })
  await prisma.$disconnect()
})

test('registration plan/price validation maps valid pairs and rejects tampering', () => {
  assert.equal(validatePlanPrice('FEATURED', stripePriceIds.FEATURED)?.name, 'FEATURED')
  assert.equal(validatePlanPrice('FEATURED', 'price_tampered'), null)
  assert.equal(validatePlanPrice('FREE', ''), null)
  assert.equal(validatePlanPrice('UNKNOWN', 'price_tampered'), null)
})

test('dynamic plan checkout validation resolves active plans by code and price', async () => {
  // Requires the dynamic BrokerSubscriptionPlan records to be seeded.
  const featured = await prisma.brokerSubscriptionPlan.findFirst({ where: { code: 'FEATURED' } })
  if (featured?.stripePriceId) {
    const ok = await validateBrokerPlanForCheckout('FEATURED', featured.stripePriceId)
    assert.equal(ok.ok, true)
    const tampered = await validateBrokerPlanForCheckout('FEATURED', 'price_tampered')
    assert.equal(tampered.ok, false)
    const inactive = await validateBrokerPlanForCheckout('UNKNOWN', 'price_tampered')
    assert.equal(inactive.ok, false)
  } else {
    // No Stripe price configured in this environment — the check still resolves
    // the plan existence/activity but must fail on the price mismatch.
    const tampered = await validateBrokerPlanForCheckout('FEATURED', 'price_tampered')
    assert.equal(tampered.ok, false)
  }
})

test('effective entitlement resolves missing, FREE, inactive paid, and active paid states', () => {
  assert.equal(SubscriptionService.effectiveSubscription(null).plan, 'FREE')
  assert.equal(SubscriptionService.effectiveSubscription({ plan: 'FREE', isActive: true }).isActive, true)
  assert.equal(SubscriptionService.effectiveSubscription({ plan: 'PREMIUM', isActive: false }).plan, 'FREE')
  assert.equal(SubscriptionService.effectiveSubscription({ plan: 'PREMIUM', isActive: true }).plan, 'FREE')
})

test('Stripe event IDs are durable and duplicate insertion is rejected', async () => {
  const eventId = `${prefix}-event`
  eventIds.push(eventId)
  await prisma.stripeWebhookEvent.create({
    data: {
      eventId,
      eventType: 'customer.subscription.updated',
      status: StripeWebhookEventStatus.PROCESSED,
      eventCreatedAt: Math.floor(Date.now() / 1000),
      processedAt: new Date(),
    },
  })
  await assert.rejects(
    prisma.stripeWebhookEvent.create({
      data: {
        eventId,
        eventType: 'customer.subscription.updated',
        status: StripeWebhookEventStatus.PROCESSING,
        eventCreatedAt: Math.floor(Date.now() / 1000),
      },
    }),
    /Unique constraint failed/,
  )
})
