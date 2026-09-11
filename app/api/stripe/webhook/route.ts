/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import prisma from '@/lib/prisma'
import { SubscriptionService } from '@/lib/subscription'
import { getCorrelationId } from '@/lib/correlation'
import { getStripeSecretKey, getStripeWebhookSecret } from '@/lib/stripe-config'
import { sendSubscriptionPurchaseEmail, sendCompanySubscriptionPurchaseEmail, sendBrokerPaymentFailureEmail, sendCompanyPaymentFailureEmail } from '@/actions/email.action'

async function getStripe(): Promise<Stripe> {
  const key = await getStripeSecretKey()
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured')
  return new Stripe(key)
}

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

// Exported for webhook-path tests. Production entry remains POST below.
export async function handleStripeEvent(event: Stripe.Event) {
  // Server-side event gate: only allowlisted events the app handles are
  // processed. Critical billing events are always processed; optional events
  // that an admin disabled are skipped (still idempotently logged as PROCESSED
  // with a skipped note by the caller).
  const { SUPPORTED_STRIPE_EVENTS, getEnabledStripeEvents } = await import('@/lib/stripe-config')
  const meta = SUPPORTED_STRIPE_EVENTS.find((supported) => supported.type === event.type)
  if (meta) {
    const enabled = await getEnabledStripeEvents()
    if (!meta.critical && !enabled.has(event.type)) {
      // Event disabled by admin — skip processing. Billing-critical events are
      // never disabled.
      console.info('Stripe webhook event skipped (disabled by config)', { eventId: event.id, eventType: event.type })
      return
    }
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (!session.customer || !session.subscription) return
      const subscription = await (await getStripe()).subscriptions.retrieve(session.subscription as string)
      const updated = await SubscriptionService.updateSubscriptionFromStripe(
        session.customer as string,
        subscription.id,
        subscription.status,
        subscription.items.data[0]?.price.id,
        subscription.metadata?.ownerType || session.metadata?.ownerType || null,
      )
      // Broker-product subscription purchase/activation confirmation. Fires only
      // when the synced row is a BrokerSubscription that became active (a
      // broker-registration checkout resolves to the registration subscription
      // and intentionally produces no broker purchase email here). Fire-and-forget
      // with a deterministic per-subscription idempotency key; the sync result is
      // never affected by email delivery.
      if (updated && 'brokerId' in updated && updated.isActive && typeof updated.id === 'string') {
        void sendSubscriptionPurchaseEmail(updated.id)
      }
      // Company-product subscription purchase/activation confirmation. Fires
      // only when the synced row is a CompanySubscription that became active.
      // Fire-and-forget with a deterministic idempotency key scoped to
      // (companySubscriptionId, stripeSubscription.id): the authoritative
      // Stripe subscription identity distinguishes a genuinely new activation
      // (cancel + re-subscribe) from a replay/retry of the same activation, and
      // the sync result is never affected by email delivery.
      if (updated && 'companyId' in updated && updated.isActive && typeof updated.id === 'string') {
        void sendCompanySubscriptionPurchaseEmail(updated.id, subscription.id)
      }
      return
    }
    case 'checkout.session.expired': {
      // An abandoned Company Checkout Session must not leave the local company
      // subscription permanently in CHECKOUT_PENDING. Reconcile it to the
      // neutral EXPIRED state only when no live subscription exists; a stale
      // expiry never cancels an ACTIVE subscription and a late
      // checkout.session.completed can still establish ACTIVE afterwards.
      const session = event.data.object as Stripe.Checkout.Session
      const ownerType = session.metadata?.ownerType || null
      if (ownerType === 'COMPANY' && session.customer) {
        await SubscriptionService.reconcileCompanyCheckoutExpired(
          session.customer as string,
          ownerType,
          { companyId: session.metadata?.companyId || null },
        )
      } else if (ownerType === 'BROKER_REGISTRATION' && session.customer) {
        await SubscriptionService.reconcileBrokerRegistrationCheckoutExpired(
          session.customer as string,
          ownerType,
          { registrationId: session.metadata?.brokerRegistrationId || null },
        )
      }
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
      const subscription = await (await getStripe()).subscriptions.retrieve(invoice.subscription as string)
      const updated = await SubscriptionService.updateSubscriptionFromStripe(
        subscription.customer as string,
        subscription.id,
        event.type === 'invoice.payment_failed' ? 'past_due' : subscription.status,
        subscription.items.data[0]?.price.id,
        subscription.metadata?.ownerType || null,
      )
      // Payment-failure notification. Dispatched only after the subscription
      // state is reconciled, only for actual failures, and only when the sync
      // resolved a product-owned subscription row. Broker registration rows
      // (registrationId) and ambiguous/unknown ownership intentionally produce
      // no notification. Fire-and-forget: the durable senders own per-
      // subscription + per-invoice idempotency, and email delivery can never
      // affect or roll back billing state.
      if (
        event.type === 'invoice.payment_failed' &&
        updated &&
        typeof updated.id === 'string' &&
        typeof invoice.id === 'string'
      ) {
        if ('brokerId' in updated) {
          void sendBrokerPaymentFailureEmail(updated.id, invoice.id)
        } else if ('companyId' in updated) {
          void sendCompanyPaymentFailureEmail(updated.id, invoice.id)
        }
      }
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
    const webhookSecret = await getStripeWebhookSecret()
    if (!webhookSecret) return NextResponse.json({ error: 'Webhook signature verification is not configured' }, { status: 500 })
    const event = (await getStripe()).webhooks.constructEvent(body, signature, webhookSecret)
    const result = await processEvent(event)
    console.info('Stripe webhook processed', { correlationId, eventId: event.id, eventType: event.type, ...result })
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook error', { correlationId, error: error instanceof Error ? error.message : 'Unknown error' })
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
