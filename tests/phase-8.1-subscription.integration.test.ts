import assert from 'node:assert/strict'
import test, { after, before } from 'node:test'
import { PrismaClient, StripeWebhookEventStatus } from '@prisma/client'
import { subscriptionPlans, validatePlanPrice } from '../lib/stripe'
import { SubscriptionService } from '../lib/subscription'

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

test('authoritative plan catalog maps valid pairs and rejects tampering', () => {
  for (const plan of subscriptionPlans.filter((item) => item.name !== 'FREE')) {
    assert.equal(validatePlanPrice(plan.name, plan.stripePriceId)?.name, plan.name)
    assert.equal(validatePlanPrice(plan.name, 'price_tampered'), null)
  }
  assert.equal(validatePlanPrice('UNKNOWN', 'price_tampered'), null)
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
