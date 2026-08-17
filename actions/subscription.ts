// action 
"use server"
import { SubscriptionPlan } from '@prisma/client'
import Stripe from 'stripe'
import { validatePlanPrice } from '@/lib/stripe'
import { getCurrentUser } from '@/lib/currentUser'
import prisma from '@/lib/prisma'
import { CheckoutConflictError, SubscriptionService } from '@/lib/subscription'
// console.log(process.env.STRIPE_SECRET_KEY)
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set in environment variables')
}

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
//   apiVersion: '2024-06-20',
  typescript: true,
})
export async function createStripeCustomer() {
  const user = await getCurrentUser()
  if (!user?.email) throw new Error('Unauthorized')
  if (!user.brokerProfile) throw new Error('Broker profile not found')

  if (user.stripeCustomerId) {
    return stripe.customers.retrieve(user.stripeCustomerId)
  }

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name || undefined,
    metadata: {
      userId: user.id,
      ...(user.brokerProfile ? { brokerId: user.brokerProfile.id } : {}),
    },
  }, {
    idempotencyKey: `stripe_customer_${user.id}`,
  })

  await prisma.brokerSubscription.upsert({
    where: { brokerId: user.brokerProfile.id },
    update: { stripeCustomerId: customer.id },
    create: {
      brokerId: user.brokerProfile.id,
      plan: 'FREE',
      isActive: false,
      stripeCustomerId: customer.id,
    },
  })

  return customer
}

export async function createCheckoutSession(
  customerId: string,
  priceId: string,
  userId: string,
  plan: SubscriptionPlan
) {
  const user = await getCurrentUser()
  if (!user || user.id !== userId || user.stripeCustomerId !== customerId) {
    throw new Error('Unauthorized subscription customer')
  }
  if (!validatePlanPrice(plan, priceId)) {
    throw new Error('Invalid subscription plan or price')
  }
  const session = await SubscriptionService.withCheckoutLock(user.brokerProfile!.id, async () => {
    const conflict = await SubscriptionService.findCheckoutConflict(user.brokerProfile!.id, customerId)
    if (conflict?.checkoutUrl) throw new CheckoutConflictError('Checkout already in progress')
    if (conflict) throw new CheckoutConflictError(conflict.reason || 'Checkout is unavailable')

    await SubscriptionService.assertStripeCustomerOwnership(user.id, user.brokerProfile!.id, customerId)
    return stripe.checkout.sessions.create({
    customer: customerId,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode: 'subscription',
    success_url: `${process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_URL || ''}/broker/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_URL || ''}/broker/subscription`,
    subscription_data: {
      metadata: {
        userId,
        plan
      }
    },
    metadata: {
      userId,
      plan
    },
    payment_method_types: ['card'],
    billing_address_collection: 'required',
    }, {
      idempotencyKey: `checkout_${user.id}_${customerId}_${plan}_${priceId}`,
    })
  })

  return session
}

export async function createPortalSession(customerId: string, returnUrl?: string) {
  const user = await getCurrentUser()
  if (!user || user.stripeCustomerId !== customerId) {
    throw new Error('Unauthorized subscription customer')
  }
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl || `${process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_URL || ''}/dashboard/subscription`,
  })

  return session
}

export async function getSubscription(subscriptionId: string) {
  const user = await getCurrentUser()
  if (!user || user.subscriptionId !== subscriptionId || !user.brokerProfile || !user.stripeCustomerId) {
    throw new Error('Unauthorized subscription')
  }
  await SubscriptionService.assertStripeCustomerOwnership(user.id, user.brokerProfile.id, user.stripeCustomerId)
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  if (subscription.customer !== user.stripeCustomerId) throw new Error('Unauthorized subscription')
  return subscription
}

export async function cancelSubscription(subscriptionId: string) {
  const user = await getCurrentUser()
  if (!user || user.subscriptionId !== subscriptionId || !user.brokerProfile || !user.stripeCustomerId) {
    throw new Error('Unauthorized subscription')
  }
  await SubscriptionService.assertStripeCustomerOwnership(user.id, user.brokerProfile.id, user.stripeCustomerId)
  const result = await SubscriptionService.withCheckoutLock(user.brokerProfile.id, async () => {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    if (subscription.customer !== user.stripeCustomerId) throw new Error('Unauthorized subscription')
    return await stripe.subscriptions.cancel(subscriptionId, {}, {
      idempotencyKey: `cancel_${user.id}_${user.stripeCustomerId}_${subscriptionId}`,
    })
  })
  await SubscriptionService.syncWithStripe(user.brokerProfile.id)
  return result
}

export async function updateSubscription(
  subscriptionId: string,
  priceId: string,
  prorationDate?: number
) {
  const user = await getCurrentUser()
  if (!user || user.subscriptionId !== subscriptionId || !user.brokerProfile || !user.stripeCustomerId) {
    throw new Error('Unauthorized subscription')
  }
  if (!validatePlanPrice('FEATURED', priceId)) {
    throw new Error('Invalid subscription price')
  }
  await SubscriptionService.assertStripeCustomerOwnership(user.id, user.brokerProfile.id, user.stripeCustomerId)
  return SubscriptionService.withCheckoutLock(user.brokerProfile.id, async () => {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    if (subscription.customer !== user.stripeCustomerId) throw new Error('Unauthorized subscription')
    return await stripe.subscriptions.update(subscriptionId, {
      items: [
        {
          id: subscription.items.data[0].id,
          price: priceId,
        },
      ],
      proration_date: prorationDate,
    }, {
      idempotencyKey: `upgrade_${user.id}_${subscriptionId}_${priceId}`,
    })
  })
}

export async function getCustomerSubscriptions(customerId: string) {
  const user = await getCurrentUser()
  if (!user || user.stripeCustomerId !== customerId || !user.brokerProfile) {
    throw new Error('Unauthorized subscription customer')
  }
  await SubscriptionService.assertStripeCustomerOwnership(user.id, user.brokerProfile.id, customerId)
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    expand: ['data.default_payment_method'],
  })

  return subscriptions
}
// Webhook event type guards
// export  function isCheckoutSessionCompleted(event: Stripe.Event): event is Stripe.CheckoutSessionCompletedEvent {
//   return event.type === 'checkout.session.completed'
// }

// export function isCustomerSubscriptionUpdated(event: Stripe.Event): event is Stripe.CustomerSubscriptionUpdatedEvent {
//   return event.type === 'customer.subscription.updated'
// }

// export function isCustomerSubscriptionDeleted(event: Stripe.Event): event is Stripe.CustomerSubscriptionDeletedEvent {
//   return event.type === 'customer.subscription.deleted'
// }

// export function isInvoicePaymentFailed(event: Stripe.Event): event is Stripe.InvoicePaymentFailedEvent {
//   return event.type === 'invoice.payment_failed'
// }
