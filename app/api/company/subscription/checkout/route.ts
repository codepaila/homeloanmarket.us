import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getCurrentCompany } from '@/lib/company-policy'
import { isSameOriginRequest } from '@/lib/origin'
import { SubscriptionService } from '@/lib/subscription'
import { resolveCompanyPlanForCheckout, COMPANY_PLAN_DEFAULT_NAME } from '@/lib/company-plan'
import { validateCompanyCoupon } from '@/lib/company-coupon'
import prisma from '@/lib/prisma'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  const current = await getCurrentCompany()
  if (!current) return NextResponse.json({ error: 'Company access required' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const requestedPlanId = typeof body?.planId === 'string' ? body.planId : null
  const couponCode = typeof body?.couponCode === 'string' ? body.couponCode.trim() : ''

  const plan = await resolveCompanyPlanForCheckout(requestedPlanId)
  if (!plan) return NextResponse.json({ error: 'No active company advertising plan is available' }, { status: 503 })
  const priceId = plan.stripePriceId
  if (!priceId) return NextResponse.json({ error: 'Company advertising plan is not configured for checkout.' }, { status: 503 })

  // Validate any coupon server-side before applying it to the checkout session.
  const coupon = couponCode ? await validateCompanyCoupon(couponCode) : null
  if (coupon && !coupon.valid) return NextResponse.json({ error: coupon.reason }, { status: 400 })

  try {
    const session = await SubscriptionService.withBillingLock(`company:${current.company.id}`, async () => {
      const existing = await prisma.companySubscription.findUnique({ where: { companyId: current.company.id } })
      if (existing?.isActive && existing.stripeSubId) return { url: null }
      let customerId = existing?.stripeCustomerId || null
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: current.user.email || undefined,
          name: current.company.name,
          metadata: { userId: current.user.id, companyId: current.company.id, ownerType: 'COMPANY' },
        }, { idempotencyKey: `stripe_company_customer_${current.company.id}` })
        customerId = customer.id
      } else {
        const customer = await stripe.customers.retrieve(customerId)
        if ('deleted' in customer && customer.deleted) throw new Error('Stripe customer is unavailable')
        if (customer.metadata?.companyId && customer.metadata.companyId !== current.company.id) throw new Error('Stripe customer does not belong to this company')
        if (customer.metadata?.userId && customer.metadata.userId !== current.user.id) throw new Error('Stripe customer does not belong to this account')
      }
      await prisma.companySubscription.upsert({
        where: { companyId: current.company.id },
        update: { status: 'CHECKOUT_PENDING', stripeCustomerId: customerId, plan: plan.name, planId: plan.id },
        create: { companyId: current.company.id, status: 'CHECKOUT_PENDING', stripeCustomerId: customerId, plan: plan.name, planId: plan.id },
      })
      return stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        allow_promotion_codes: true,
        ...(coupon && coupon.valid ? { discounts: [{ coupon: coupon.id }] } : {}),
        success_url: `${process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_URL || ''}/company/dashboard?subscription=success`,
        cancel_url: `${process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_URL || ''}/company/dashboard`,
        metadata: { userId: current.user.id, companyId: current.company.id, plan: plan.name, ownerType: 'COMPANY', planId: plan.id },
        subscription_data: { metadata: { userId: current.user.id, companyId: current.company.id, plan: plan.name, ownerType: 'COMPANY', planId: plan.id } },
        billing_address_collection: 'required',
      }, { idempotencyKey: `company_checkout_${current.company.id}_${customerId}_${priceId}` })
    })
    if (!session.url) return NextResponse.json({ error: 'An existing company subscription is already active' }, { status: 409 })
    return NextResponse.json({ success: true, url: session.url, planId: plan.id, planName: plan.name || COMPANY_PLAN_DEFAULT_NAME })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to start company checkout' }, { status: 500 })
  }
}
