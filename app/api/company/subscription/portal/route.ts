import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getCurrentCompany } from '@/lib/company-policy'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST() {
  const current = await getCurrentCompany()
  if (!current?.company.subscription?.stripeCustomerId) return NextResponse.json({ error: 'Company billing is not configured' }, { status: 404 })
  try {
    const customer = await stripe.customers.retrieve(current.company.subscription.stripeCustomerId)
    if ('deleted' in customer && customer.deleted) return NextResponse.json({ error: 'Company billing is unavailable' }, { status: 409 })
    if (customer.metadata?.companyId && customer.metadata.companyId !== current.company.id) return NextResponse.json({ error: 'Stripe customer does not belong to this company' }, { status: 403 })
    const session = await stripe.billingPortal.sessions.create({
      customer: current.company.subscription.stripeCustomerId,
      return_url: `${process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_URL || ''}/company/dashboard`,
    })
    return NextResponse.json({ url: session.url })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to open billing portal' }, { status: 500 })
  }
}
