import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getCurrentCompany } from '@/lib/company-policy'
import { isSameOriginRequest } from '@/lib/origin'
import { SubscriptionService } from '@/lib/subscription'
import { resolveCompanyPlanForCheckout, COMPANY_PLAN_DEFAULT_NAME } from '@/lib/company-plan'
import { validateCompanyCoupon } from '@/lib/company-coupon'
import prisma from '@/lib/prisma'
import { getStripeSecretKey } from '@/lib/stripe-config'

async function getStripe(): Promise<Stripe> {
  const key = await getStripeSecretKey()
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured')
  return new Stripe(key)
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  const current = await getCurrentCompany()
  if (!current) return NextResponse.json({ error: 'Company access required' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const requestedPlanId = typeof body?.planId === 'string' ? body.planId : null
  const couponCode = typeof body?.couponCode === 'string' ? body.couponCode.trim() : ''

  const plan = await resolveCompanyPlanForCheckout(requestedPlanId)
  if (!plan) return NextResponse.json({ error: 'No active company advertising plan is available' }, { status: 503 })

  // Resolve the authoritative Stripe price from the plan. FREE / zero-price
  // plans do not require Stripe checkout. A client-supplied price is never
  // trusted; the price is resolved server-side from the plan.
  const priceId = plan.price > 0 ? plan.stripePriceId : null
  if (plan.price > 0 && !priceId) return NextResponse.json({ error: 'Company advertising plan is not configured for checkout.' }, { status: 503 })

  try {
    // Coupons apply only to paid plans. A coupon is never a requirement for a
    // FREE plan, and an invalid coupon must not block selecting a FREE plan.
    let coupon = null
    if (plan.price > 0 && couponCode) {
      coupon = await validateCompanyCoupon(couponCode)
      if (coupon && !coupon.valid) return NextResponse.json({ error: coupon.reason }, { status: 400 })
    }

    return await SubscriptionService.withBillingLock(`company:${current.company.id}`, async () => {
      const stripe = await getStripe()
      const existing = await prisma.companySubscription.findUnique({ where: { companyId: current.company.id } })
      if (existing?.isActive && existing.stripeSubId) return { url: null, free: false }

      // Record the chosen plan before any Stripe interaction so a free plan can
      // be activated without a Stripe customer.
      await prisma.companySubscription.upsert({
        where: { companyId: current.company.id },
        update: { status: 'CHECKOUT_PENDING', plan: plan.name, planId: plan.id },
        create: { companyId: current.company.id, status: 'CHECKOUT_PENDING', plan: plan.name, planId: plan.id },
      })

      // FREE plan: activate immediately with no Stripe dependency. Coupons do
      // not apply to free plans.
      if (plan.price <= 0) {
        await prisma.companySubscription.update({
          where: { companyId: current.company.id },
          data: { status: 'ACTIVE', isActive: true, startDate: new Date(), endDate: null, plan: plan.name, planId: plan.id },
        })
        await prisma.company.update({ where: { id: current.company.id }, data: { status: 'ACTIVE' } })
        return { url: null, free: true, plan }
      }

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
      // The server fully controls the discount: the validated coupon is applied
      // directly. Promotion codes entered at the Stripe checkout UI are disabled
      // so the client cannot inject an arbitrary discount.
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{ price: priceId!, quantity: 1 }],
        mode: 'subscription',
        allow_promotion_codes: false,
        ...(coupon && coupon.valid ? { discounts: [{ coupon: coupon.id }] } : {}),
        success_url: `${process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_URL || ''}/company/dashboard?subscription=success`,
        cancel_url: `${process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_URL || ''}/company/dashboard`,
        metadata: { userId: current.user.id, companyId: current.company.id, plan: plan.name, ownerType: 'COMPANY', planId: plan.id },
        subscription_data: { metadata: { userId: current.user.id, companyId: current.company.id, plan: plan.name, ownerType: 'COMPANY', planId: plan.id } },
        billing_address_collection: 'required',
      }, { idempotencyKey: `company_checkout_${current.company.id}_${customerId}_${priceId}` })
      return { url: session.url, free: false }
    }).then((result) => {
      if (result.free) {
        return NextResponse.json({ success: true, url: null, planId: plan.id, planName: plan.name || COMPANY_PLAN_DEFAULT_NAME, free: true })
      }
      if (!result.url) return NextResponse.json({ error: 'An existing company subscription is already active' }, { status: 409 })
      return NextResponse.json({ success: true, url: result.url, planId: plan.id, planName: plan.name || COMPANY_PLAN_DEFAULT_NAME })
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to start company checkout' }, { status: 500 })
  }
}
