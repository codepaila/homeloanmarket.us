/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import prisma from '@/lib/prisma'
import { SubscriptionService } from '@/lib/subscription'
import { getCorrelationId } from '@/lib/correlation'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export function getStripeEventTarget(event: Stripe.Event) {
  const object = event.data.object as any
  const metadata = object?.metadata || {}
  const subscriptionId = typeof object?.id === 'string' && event.type.startsWith('customer.subscription.')
    ? object.id
    : typeof object?.subscription === 'string'
      ? object.subscription
      : metadata.subscriptionId || null
  return {
    customerId: typeof object?.customer === 'string' ? object.customer : metadata.customerId || null,
    subscriptionId,
  }
}

async function withWebhookSubscriptionLock<T>(subscriptionId: string | null, operation: () => Promise<T>): Promise<T> {
  if (!subscriptionId) return operation()
  return SubscriptionService.withBillingLock(`subscription:${subscriptionId}`, operation)
}

// Pure ordering predicate using Stripe's `event.created` timestamp as the
// authoritative signal: an event is stale when any applied/in-flight event is
// strictly newer.
export function isStaleEvent(latestAppliedCreatedAt: number | null, eventCreatedAt: number): boolean {
  return latestAppliedCreatedAt !== null && latestAppliedCreatedAt > eventCreatedAt
}

// Ordering guard: returns true when any known event (already PROCESSED or
// in-flight PROCESSING) for this subscription is strictly newer than the given
// event.
async function hasNewerAppliedEvent(stripeSubId: string, eventCreated: number) {
  const newer = await prisma.stripeWebhookEvent.findFirst({
    where: {
      stripeSubId,
      eventCreatedAt: { gt: eventCreated },
      status: { in: ['PROCESSED', 'PROCESSING'] },
    },
    orderBy: { eventCreatedAt: 'desc' },
    select: { eventCreatedAt: true },
  })
  return isStaleEvent(newer?.eventCreatedAt ?? null, eventCreated)
}

async function processEvent(event: Stripe.Event) {
  const target = getStripeEventTarget(event)

  return withWebhookSubscriptionLock(target.subscriptionId, async () => {
    const existing = await prisma.stripeWebhookEvent.findUnique({ where: { eventId: event.id } })
    if (existing?.status === 'PROCESSED') return { duplicate: true }
    if (existing?.status === 'PROCESSING' && existing.updatedAt > new Date(Date.now() - 5 * 60 * 1000)) {
      throw new Error('Webhook event is already processing')
    }
    let retrying = false
    if (existing?.status === 'FAILED' || existing?.status === 'PROCESSING') {
      await prisma.stripeWebhookEvent.update({ where: { eventId: event.id }, data: { status: 'PROCESSING', error: null } })
      retrying = true
    }

    // Register the event as in-flight BEFORE the ordering check so that
    // concurrently delivered events for the same subscription can see it.
    if (!retrying) {
      try {
        await prisma.stripeWebhookEvent.create({
          data: {
            eventId: event.id,
            eventType: event.type,
            status: 'PROCESSING',
            eventCreatedAt: event.created,
            stripeCustomerId: target.customerId,
            stripeSubId: target.subscriptionId,
          },
        })
      } catch (error: any) {
        if (error?.code === 'P2002') return { duplicate: true }
        throw error
      }
    }

    const stale = target.subscriptionId
      ? await hasNewerAppliedEvent(target.subscriptionId, event.created)
      : false

    try {
      if (!stale) await handleStripeEvent(event)
      await prisma.stripeWebhookEvent.update({
        where: { eventId: event.id },
        data: { status: 'PROCESSED', processedAt: new Date(), error: stale ? 'STALE_EVENT_IGNORED' : null },
      })
      return { duplicate: false, stale: Boolean(stale) }
    } catch (error) {
      await prisma.stripeWebhookEvent.update({
        where: { eventId: event.id },
        data: { status: 'FAILED', error: error instanceof Error ? error.message : 'Unknown webhook failure' },
      })
      throw error
    }
  })
}

async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (!session.customer || !session.subscription) return
      const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
      await SubscriptionService.updateSubscriptionFromStripe(
        session.customer as string,
        subscription.id,
        subscription.status,
        subscription.items.data[0]?.price.id,
        subscription.metadata?.ownerType || session.metadata?.ownerType || null,
      )
      return
    }
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      await SubscriptionService.updateSubscriptionFromStripe(
        subscription.customer as string,
        subscription.id,
        subscription.status,
        subscription.items.data[0]?.price.id,
        subscription.metadata?.ownerType || null,
      )
      return
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      await SubscriptionService.updateSubscriptionFromStripe(
        subscription.customer as string,
        subscription.id,
        'canceled',
        subscription.items.data[0]?.price.id,
        subscription.metadata?.ownerType || null,
      )
      return
    }
    case 'invoice.payment_failed':
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as any
      if (!invoice.subscription) return
      const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string)
      await SubscriptionService.updateSubscriptionFromStripe(
        subscription.customer as string,
        subscription.id,
        event.type === 'invoice.payment_failed' ? 'past_due' : subscription.status,
        subscription.items.data[0]?.price.id,
        subscription.metadata?.ownerType || null,
      )
      return
    }
    default:
      return
  }
}

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationId(request)
  const body = await request.text()
  const signature = (await headers()).get('stripe-signature')
  if (!signature) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })

  try {
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    const result = await processEvent(event)
    console.info('Stripe webhook processed', { correlationId, eventId: event.id, eventType: event.type, ...result })
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook error', { correlationId, error: error instanceof Error ? error.message : 'Unknown error' })
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
