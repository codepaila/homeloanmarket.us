import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getCurrentCompany } from '@/lib/company-policy'
import { isSameOriginRequest } from '@/lib/origin'
import { SubscriptionService } from '@/lib/subscription'
import { resolveCompanyPlanForCheckout, getCanonicalCompanyAdvertisingPlan, COMPANY_PLAN_DEFAULT_NAME } from '@/lib/company-plan'
import { isCompanyProfileComplete } from '@/lib/company-onboarding-state'
import { validateCompanyCoupon } from '@/lib/company-coupon'
import { buildCompanyCheckoutIdempotencyKey } from '@/lib/company-checkout'
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

  // Company profile completion is a hard prerequisite for advertising checkout:
  // a PENDING/incomplete company may not purchase advertising before its
  // required profile fields are completed (onboarding sets status=ACTIVE +
  // onboardedAt). This is the authoritative server-side gate — the plan-select
  // page also redirects incomplete companies to onboarding, but a direct API
  // call must be rejected here regardless of UI state.
  if (!isCompanyProfileComplete(current.company)) {
    return NextResponse.json(
      { error: 'Complete your company profile before selecting an advertising plan.', code: 'PROFILE_REQUIRED' },
      { status: 403 },
    )
  }

  const body = await request.json().catch(() => ({}))
  const requestedPlanId = typeof body?.planId === 'string' ? body.planId : null
  const couponCode = typeof body?.couponCode === 'string' ? body.couponCode.trim() : ''

  const plan = await resolveCompanyPlanForCheckout(requestedPlanId)
  if (!plan) return NextResponse.json({ error: 'No active company advertising plan is available' }, { status: 503 })

  // Exactly one customer-facing company advertising plan. Even if legacy
  // inactive rows (or an admin misconfiguration) leave more than one active
  // plan in the database, only the canonical customer-facing plan is
  // purchasable. Historical records are never deleted; they are simply not
  // selectable.
  const canonicalPlan = await getCanonicalCompanyAdvertisingPlan()
  if (!canonicalPlan || canonicalPlan.id !== plan.id) {
    return NextResponse.json({ error: 'This advertising plan is not available for purchase' }, { status: 400 })
  }

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
      let existing = await prisma.companySubscription.findUnique({ where: { companyId: current.company.id } })
      if (existing?.isActive && existing.stripeSubId) return { url: null, free: false }

      // Bounded stale-checkout reconciliation (this company only — no full-DB
      // scan). If a prior checkout session was abandoned and left this row in
      // CHECKOUT_PENDING with no live Stripe subscription, move it to EXPIRED
      // so the fresh checkout below is not misrepresented. If Stripe already
      // has a live subscription (the webhook is merely delayed), the same
      // reconciliation syncs that authoritative state into the local row. The
      // webhook's checkout.session.expired handler is the authoritative
      // event-driven path; this is the belt-and-suspenders reconcile for
      // pre-existing stale rows.
      if (existing?.status === 'CHECKOUT_PENDING') {
        await SubscriptionService.reconcileStaleCompanyCheckout(current.company.id, existing.stripeCustomerId)
        // Re-read: the reconcile may have promoted the row to an active
        // subscription, in which case a second Checkout must never be created.
        existing = await prisma.companySubscription.findUnique({ where: { companyId: current.company.id } })
        if (existing?.isActive && existing.stripeSubId) return { url: null, free: false }
      }

      // Record the chosen plan before any Stripe interaction so a free plan can
      // be activated without a Stripe customer. The promotion code is persisted
      // here from authoritative server-validated data only (the resolved
      // promotion_code ID); a client-supplied Stripe ID is never trusted, and
      // promo storage never affects entitlement. FREE plans never store a code.
      const promotionCodeId = coupon && coupon.valid ? coupon.promotionCodeId : null
      await prisma.companySubscription.upsert({
        where: { companyId: current.company.id },
        update: { status: 'CHECKOUT_PENDING', plan: plan.name, planId: plan.id, stripePromotionCodeId: promotionCodeId },
        create: { companyId: current.company.id, status: 'CHECKOUT_PENDING', plan: plan.name, planId: plan.id, stripePromotionCodeId: promotionCodeId },
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
        update: { status: 'CHECKOUT_PENDING', stripeCustomerId: customerId, plan: plan.name, planId: plan.id, stripePromotionCodeId: promotionCodeId },
        create: { companyId: current.company.id, status: 'CHECKOUT_PENDING', stripeCustomerId: customerId, plan: plan.name, planId: plan.id, stripePromotionCodeId: promotionCodeId },
      })
      // The server fully controls the discount. The client supplies only a code
      // string which is re-validated server-side via Stripe Promotion Codes; the
      // resolved promotion_code is passed to Checkout through `discounts` so
      // Stripe remains the authoritative source of truth for validity and the
      // discount amount (expiration, redemption limits, eligibility, product
      // restrictions). When a valid coupon exists, `discounts` is sent and
      // `allow_promotion_codes` is omitted (Stripe rejects both simultaneously).
      // When no coupon exists, `allow_promotion_codes: false` is sent so the
      // client cannot inject an arbitrary code without server validation.
      //
      // Managed Payments is enabled by default on this account and rejects an
      // explicit `payment_method_types` parameter. The account's products are
      // not yet Managed-Payments eligible (Stripe rejects them even with an
      // eligible tax code), so Managed Payments is disabled FOR THIS SESSION
      // only — Stripe's recommended escape hatch — and never globally. The
      // account's default payment methods (card) are used automatically.
      // Stripe supports `managed_payments[enabled]` on session creation but the
      // installed SDK type lags the API, so the params object is cast.
      const sessionParams = {
        customer: customerId,
        line_items: [{ price: priceId!, quantity: 1 }],
        mode: 'subscription' as const,
        managed_payments: { enabled: false },
        ...(coupon && coupon.valid
          ? { discounts: [{ promotion_code: coupon.promotionCodeId }] }
          : { allow_promotion_codes: false }),
        success_url: `${process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_URL || ''}/company/dashboard?subscription=success`,
        cancel_url: `${process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_URL || ''}/company/subscription/select`,
        metadata: { userId: current.user.id, companyId: current.company.id, plan: plan.name, ownerType: 'COMPANY', planId: plan.id },
        subscription_data: { metadata: { userId: current.user.id, companyId: current.company.id, plan: plan.name, ownerType: 'COMPANY', planId: plan.id } },
        billing_address_collection: 'required' as const,
      }

      // Duplicate prevention + retry safety:
      //  - Reuse an in-progress (open) Checkout Session for this company+plan
      //    so concurrent/duplicate submissions never create a second session.
      //  - The idempotency key is content-fingerprinted over every material
      //    checkout parameter, so a changed configuration (e.g. Managed
      //    Payments handling), a different coupon, or a different plan rotates
      //    the key and Stripe never rejects it as an incompatible retry.
      //  - A prior canceled/expired session id rotates the key once more so a
      //    retry after cancellation creates a fresh Checkout Session.
      const priorSessions = await stripe.checkout.sessions.list({ customer: customerId, limit: 100 })
      const priorCheckout = priorSessions.data.find(
        (session) =>
          session.mode === 'subscription' &&
          session.metadata?.companyId === current.company.id &&
          session.metadata?.planId === plan.id,
      )
      if (priorCheckout?.status === 'open' && priorCheckout.url) {
        return { url: priorCheckout.url, free: false }
      }

      const idempotencyKey = buildCompanyCheckoutIdempotencyKey({
        companyId: current.company.id,
        customerId,
        priceId: priceId!,
        planId: plan.id,
        planName: plan.name,
        mode: 'subscription',
        allowPromotionCodes: Boolean(coupon && coupon.valid),
        managedPaymentsEnabled: false,
        couponId: coupon && coupon.valid ? coupon.promotionCodeId : null,
        billingAddressCollection: 'required',
        priorSessionId: priorCheckout ? priorCheckout.id : null,
      })
      const session = await stripe.checkout.sessions.create(
        sessionParams as Stripe.Checkout.SessionCreateParams,
        { idempotencyKey },
      )
      return { url: session.url, free: false }
    }).then((result) => {
      if (result.free) {
        return NextResponse.json({ success: true, url: null, planId: plan.id, planName: plan.name || COMPANY_PLAN_DEFAULT_NAME, free: true })
      }
      if (!result.url) return NextResponse.json({ error: 'An existing company subscription is already active' }, { status: 409 })
      return NextResponse.json({ success: true, url: result.url, planId: plan.id, planName: plan.name || COMPANY_PLAN_DEFAULT_NAME })
    })
  } catch (error) {
    // Preserve the real provider error in server logs (never secrets), but
    // return a safe, user-friendly message to the browser.
    console.error('Company advertising checkout failed', {
      companyId: current.company.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return NextResponse.json(
      { error: "We couldn't start checkout right now. Please try again." },
      { status: 500 },
    )
  }
}
