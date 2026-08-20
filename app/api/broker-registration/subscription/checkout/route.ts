import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getCurrentUser } from '@/lib/currentUser'
import { isSameOriginRequest } from '@/lib/origin'
import { validatePlanPrice } from '@/lib/stripe'
import { CheckoutConflictError, SubscriptionService } from '@/lib/subscription'
import prisma from '@/lib/prisma'
import { getStripeSecretKey } from '@/lib/stripe-config'

async function getStripe(): Promise<Stripe> {
  const key = await getStripeSecretKey()
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured')
  return new Stripe(key)
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }

  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'BROKER') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (user.brokerProfile) return NextResponse.json({ redirectTo: '/broker/dashboard' })
    if (!user.brokerRegistration) return NextResponse.json({ error: 'Broker registration not found' }, { status: 404 })

    const { priceId, plan } = await request.json()
    if (plan !== 'FEATURED' || !validatePlanPrice(plan, priceId)) {
      return NextResponse.json({ error: 'Invalid subscription plan or price' }, { status: 400 })
    }

    const registrationId = user.brokerRegistration.id
    const checkoutSession = await SubscriptionService.withBillingLock(`broker-registration:${registrationId}`, async () => {
      const stripe = await getStripe()
      const current = await prisma.brokerRegistrationSubscription.findUnique({ where: { registrationId } })
      if (current?.status === 'ACTIVE' && current.isActive && current.stripeSubId) {
        throw new CheckoutConflictError('An existing subscription must be managed before another checkout.')
      }
      let customerId = current?.stripeCustomerId || null

      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email || undefined,
          name: user.name || undefined,
          metadata: { userId: user.id, brokerRegistrationId: registrationId, ownerType: 'BROKER_REGISTRATION' },
        }, { idempotencyKey: `stripe_registration_customer_${registrationId}` })
        customerId = customer.id
      } else {
        const customer = await stripe.customers.retrieve(customerId)
        if ('deleted' in customer && customer.deleted) throw new Error('Stripe customer is unavailable')
        if (customer.metadata?.userId && customer.metadata.userId !== user.id) throw new Error('Stripe customer does not belong to this account')
        if (customer.metadata?.brokerRegistrationId && customer.metadata.brokerRegistrationId !== registrationId) throw new Error('Stripe customer does not belong to this registration')
      }

      await prisma.brokerRegistrationSubscription.upsert({
        where: { registrationId },
        update: { plan: 'FEATURED', status: 'CHECKOUT_PENDING', stripeCustomerId: customerId },
        create: { registrationId, plan: 'FEATURED', status: 'CHECKOUT_PENDING', stripeCustomerId: customerId },
      })
      const openSessions = await stripe.checkout.sessions.list({ customer: customerId, status: 'open', limit: 20 })
      const openSession = openSessions.data.find((session) => session.mode === 'subscription' && session.metadata?.brokerRegistrationId === registrationId)
      if (openSession?.url) return { url: openSession.url }

      return stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        success_url: `${process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_URL || ''}/broker-registration/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_URL || ''}/broker/subscription/select`,
        metadata: { userId: user.id, brokerRegistrationId: registrationId, plan: 'FEATURED' },
        subscription_data: { metadata: { userId: user.id, brokerRegistrationId: registrationId, plan: 'FEATURED' } },
        billing_address_collection: 'required',
      }, { idempotencyKey: `registration_checkout_${registrationId}_${customerId}_FEATURED_${priceId}` })
    })

    return NextResponse.json({ success: true, url: checkoutSession.url })
  } catch (error) {
    if (error instanceof CheckoutConflictError) return NextResponse.json({ error: error.message }, { status: 409 })
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to create checkout session' }, { status: 500 })
  }
}
