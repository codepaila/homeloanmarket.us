import Stripe from 'stripe'
import { SubscriptionService } from '@/lib/subscription'
import prisma from '@/lib/prisma'
import { getStripeSecretKey } from '@/lib/stripe-config'

async function getStripe(): Promise<Stripe> {
  const key = await getStripeSecretKey()
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured')
  return new Stripe(key)
}

// The authenticated user shape the checkout verification needs. Mirrors the
// broker-registration subset of the getCurrentUser() result.
export type BrokerRegistrationVerifyUser = {
  id: string
  role?: string | null
  brokerRegistration?: { id: string } | null
}

export type BrokerRegistrationVerifyResult =
  | { ok: true; plan: string }
  | { ok: false; reason: string; status: number }

// Verify + synchronize a broker-registration FEATURED checkout return.
//
// Server-authoritative only:
//   - the Stripe Checkout Session is retrieved and validated for ownership
//     (customer id + userId + brokerRegistrationId metadata),
//   - the Checkout Session must be `complete` with `payment_status: paid`,
//   - the Stripe Subscription must be `active`/`trialing`,
//   - then the registration subscription is synchronized to ACTIVE through the
//     same SubscriptionService.updateRegistrationSubscriptionFromStripe used by
//     the Stripe webhook (idempotent; the webhook and this return handler can
//     run in any order without creating duplicate state).
//
// Used by both the API verify route and the server-side success return page. It
// never finalizes a Broker — finalization stays in finalizeBrokerRegistration().
export async function verifyBrokerRegistrationCheckout(params: {
  user: BrokerRegistrationVerifyUser | null
  sessionId: string
}): Promise<BrokerRegistrationVerifyResult> {
  const { user, sessionId } = params

  if (!user || user.role !== 'BROKER') {
    return { ok: false, reason: 'Unauthorized', status: 401 }
  }
  if (!user.brokerRegistration) {
    return { ok: false, reason: 'Broker registration not found', status: 404 }
  }
  if (!sessionId || !sessionId.startsWith('cs_')) {
    return { ok: false, reason: 'Invalid checkout session', status: 400 }
  }

  try {
    const stripe = await getStripe()

    const local = await prisma.brokerRegistrationSubscription.findUnique({
      where: { registrationId: user.brokerRegistration.id },
      select: { stripeCustomerId: true },
    })
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
    if (!customerId || customerId !== local?.stripeCustomerId) {
      return { ok: false, reason: 'Checkout session does not belong to this account', status: 403 }
    }
    if (session.metadata?.userId && session.metadata.userId !== user.id) {
      return { ok: false, reason: 'Checkout session does not belong to this account', status: 403 }
    }
    if (session.metadata?.brokerRegistrationId && session.metadata.brokerRegistrationId !== user.brokerRegistration.id) {
      return { ok: false, reason: 'Checkout session does not belong to this registration', status: 403 }
    }
    if (session.status !== 'complete' || session.payment_status !== 'paid' || typeof session.subscription !== 'string') {
      return { ok: false, reason: 'Checkout session is not complete', status: 409 }
    }

    const stripeSubscription = await stripe.subscriptions.retrieve(session.subscription)
    if (!['active', 'trialing'].includes(stripeSubscription.status)) {
      return { ok: false, reason: 'Subscription is not active', status: 409 }
    }

    const updated = await SubscriptionService.updateRegistrationSubscriptionFromStripe(
      customerId,
      stripeSubscription.id,
      stripeSubscription.status,
      stripeSubscription.items.data[0]?.price.id,
    )
    if (!updated) return { ok: false, reason: 'Registration subscription not found', status: 404 }

    return { ok: true, plan: updated.plan }
  } catch (error) {
    console.error('Broker registration subscription verification failed:', error)
    return { ok: false, reason: 'Unable to verify checkout session', status: 500 }
  }
}