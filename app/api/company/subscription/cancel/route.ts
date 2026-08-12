import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getCurrentCompany } from '@/lib/company-policy'
import { isSameOriginRequest } from '@/lib/origin'
import { SubscriptionService } from '@/lib/subscription'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  const current = await getCurrentCompany()
  if (!current?.company.subscription?.stripeSubId || !current.company.subscription.stripeCustomerId) return NextResponse.json({ error: 'Active company subscription not found' }, { status: 404 })
  try {
    await SubscriptionService.withBillingLock(`company:${current.company.id}`, async () => {
      const subscription = await stripe.subscriptions.retrieve(current.company.subscription!.stripeSubId!)
      if (subscription.customer !== current.company.subscription!.stripeCustomerId) throw new Error('Stripe customer does not belong to this company')
      const customer = await stripe.customers.retrieve(current.company.subscription!.stripeCustomerId!)
      if ('deleted' in customer && customer.deleted) throw new Error('Stripe customer is unavailable')
      if (customer.metadata?.companyId && customer.metadata.companyId !== current.company.id) throw new Error('Stripe customer does not belong to this company')
      await stripe.subscriptions.cancel(subscription.id, {}, { idempotencyKey: `company_cancel_${current.company.id}_${subscription.id}` })
      await SubscriptionService.updateCompanySubscriptionFromStripe(current.company.subscription!.stripeCustomerId!, subscription.id, 'canceled')
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to cancel company subscription' }, { status: 500 })
  }
}
