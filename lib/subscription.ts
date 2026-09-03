/* eslint-disable @typescript-eslint/no-explicit-any */
import { SubscriptionPlan } from '@prisma/client'
import Stripe from 'stripe'
import crypto from 'crypto'
import { Redis } from '@upstash/redis'
import prisma from '@/lib/prisma'
import { listBrokerPlansPublic } from '@/lib/broker-plans'
import { resolveCompanyPlanByStripePrice } from '@/lib/company-plan'
import { getStripeSecretKey } from '@/lib/stripe-config'

// Resolves the authoritative Stripe client from the configured secret key
// (encrypted DB value first, then environment fallback).
async function getStripe(): Promise<Stripe> {
  const key = await getStripeSecretKey()
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured')
  return new Stripe(key)
}

export class CheckoutConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CheckoutConflictError'
  }
}

export class BillingUnavailableError extends Error {
  constructor() {
    super('Billing is temporarily unavailable. Please try again.')
    this.name = 'BillingUnavailableError'
  }
}

// Thrown when a plan-deactivation cascade cannot cancel every active
// subscription. Carries the set of failed company subscription IDs so the
// caller can report a partial failure and retry safely; the plan is left
// active when this is thrown.
export class PlanDeactivationError extends Error {
  constructor(
    message: string,
    public readonly failedCompanySubscriptionIds: string[],
  ) {
    super(message)
    this.name = 'PlanDeactivationError'
  }
}

// Maps a Stripe subscription status to the local CompanySubscriptionStatus.
// Only 'active'/'trialing' are ACTIVE (isActive=true). Every other state maps
// to a distinct non-active status so admin/UI can tell unpaid, paused, and
// incomplete apart from a generic expiry — none of them ever grants access.
export function mapCompanySubscriptionStatus(stripeStatus: string): {
  status: 'ACTIVE' | 'PAST_DUE' | 'INCOMPLETE' | 'INCOMPLETE_EXPIRED' | 'UNPAID' | 'PAUSED' | 'CANCELED' | 'EXPIRED'
  isActive: boolean
} {
  switch (stripeStatus) {
    case 'active':
    case 'trialing':
      return { status: 'ACTIVE', isActive: true }
    case 'past_due':
      return { status: 'PAST_DUE', isActive: false }
    case 'incomplete':
      return { status: 'INCOMPLETE', isActive: false }
    case 'incomplete_expired':
      return { status: 'INCOMPLETE_EXPIRED', isActive: false }
    case 'unpaid':
      return { status: 'UNPAID', isActive: false }
    case 'paused':
      return { status: 'PAUSED', isActive: false }
    case 'canceled':
      return { status: 'CANCELED', isActive: false }
    default:
      return { status: 'EXPIRED', isActive: false }
  }
}

// Resolves the plan code for a Stripe price from the database. Returns the
// matched plan code, or falls back to 'FREE' for an unmatched/unknown price.
export async function getPlanForStripePrice(priceId: unknown): Promise<string> {
  const plan = await prisma.brokerSubscriptionPlan.findFirst({
    where: { stripePriceId: typeof priceId === 'string' ? priceId : '' },
    select: { code: true },
  })
  return plan?.code || 'FREE'
}

// Resolve the database plan for a Stripe price. Falls back to FREE when the
// database is not yet reconciled so existing Stripe flows keep working.
async function resolvePlanForStripePrice(priceId: string): Promise<{ code: string; id: string | null }> {
  const plan = await prisma.brokerSubscriptionPlan.findFirst({
    where: { stripePriceId: priceId },
    select: { id: true, code: true },
  })
  if (plan) return { code: plan.code, id: plan.id }
  return { code: await getPlanForStripePrice(priceId), id: null }
}

export class SubscriptionService {
  static async withBillingLock<T>(scope: string, operation: () => Promise<T>): Promise<T> {
    let redis: Redis
    try {
      redis = Redis.fromEnv()
    } catch {
      throw new BillingUnavailableError()
    }
    const lockKey = `homeloanmarket:billing:${scope}`
    const lockValue = crypto.randomUUID()
    const leaseSeconds = 60
    let acquired: string | null
    try {
      acquired = await redis.set(lockKey, lockValue, { nx: true, ex: leaseSeconds })
    } catch {
      throw new BillingUnavailableError()
    }
    if (acquired !== 'OK') throw new CheckoutConflictError('Checkout already in progress')
    let renewalFailed = false
    const renewal = setInterval(async () => {
      try {
        const renewed = await redis.eval(
          "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('expire', KEYS[1], ARGV[2]) else return 0 end",
          [lockKey],
          [lockValue, String(leaseSeconds)],
        )
        if ((renewed as number) !== 1) renewalFailed = true
      } catch {
        renewalFailed = true
      }
    }, 10_000)
    renewal.unref?.()
    try {
      const result = await operation()
      if (renewalFailed) throw new BillingUnavailableError()
      return result
    } finally {
      clearInterval(renewal)
      try {
        const current = await redis.get<string>(lockKey)
        if (current === lockValue) await redis.del(lockKey)
      } catch {
        // The operation already completed; a short-lived lock is safer than
        // turning a successful billing operation into a client failure.
      }
    }
  }

  static async withCheckoutLock<T>(brokerId: string, operation: () => Promise<T>): Promise<T> {
    return this.withBillingLock(`broker:${brokerId}`, operation)
  }

  static async assertStripeCustomerOwnership(userId: string, brokerId: string, customerId: string) {
    const local = await prisma.brokerSubscription.findUnique({
      where: { brokerId },
      select: { stripeCustomerId: true },
    })
    if (!local?.stripeCustomerId || local.stripeCustomerId !== customerId) {
      throw new Error('Stripe customer does not belong to this account')
    }
    const customer = await (await getStripe()).customers.retrieve(customerId)
    if ('deleted' in customer && customer.deleted) throw new Error('Stripe customer is unavailable')
    if (customer.metadata?.userId && customer.metadata.userId !== userId) {
      throw new Error('Stripe customer does not belong to this account')
    }
    if (customer.metadata?.brokerId && customer.metadata.brokerId !== brokerId) {
      throw new Error('Stripe customer does not belong to this account')
    }
    return customer
  }

  static async findCheckoutConflict(brokerId: string, customerId: string) {
    const local = await prisma.brokerSubscription.findUnique({
      where: { brokerId },
      select: { plan: true, isActive: true, stripeSubId: true },
    })
    if (local?.plan === 'FEATURED' && local.isActive) {
      return { reason: 'An existing subscription must be managed before another checkout.' }
    }
    const subscriptions = await (await getStripe()).subscriptions.list({ customer: customerId, status: 'all', limit: 20 })
    const blockingSubscription = subscriptions.data.find((subscription) =>
      ['active', 'trialing', 'incomplete', 'past_due', 'unpaid', 'paused'].includes(subscription.status),
    )
    if (blockingSubscription) {
      return { reason: 'An existing subscription must be managed before another checkout.' }
    }
    const sessions = await (await getStripe()).checkout.sessions.list({ customer: customerId, status: 'open', limit: 20 })
    const openSession = sessions.data.find((session) => session.mode === 'subscription')
    if (openSession?.url) return { checkoutUrl: openSession.url }
    return null
  }

  static effectiveSubscription(subscription: { plan: string; isActive: boolean; startDate?: Date; endDate?: Date | null; stripeCustomerId?: string | null; stripeSubId?: string | null } | null) {
    const expired = Boolean(subscription?.endDate && subscription.endDate <= new Date())
    if (!subscription || subscription.plan === 'FREE' || subscription.plan !== 'FEATURED' || !subscription.isActive || expired) {
      return {
        plan: 'FREE',
        isActive: true,
        startDate: subscription?.startDate || new Date(),
        endDate: null,
        stripeCustomerId: subscription?.stripeCustomerId || null,
        stripeSubId: subscription?.stripeSubId || null,
        status: 'ACTIVE' as const,
      }
    }
    return { ...subscription, status: 'ACTIVE' as const }
  }

  // Get subscription details
  static async getSubscription(brokerId: string) {
    const subscription = await prisma.brokerSubscription.findUnique({
      where: { brokerId }
    })

    if (!subscription) return this.effectiveSubscription(null)

    // Check Stripe status if applicable
    let stripeStatus = subscription.isActive ? 'ACTIVE' : 'INACTIVE'
    
    if (subscription.stripeSubId) {
      try {
        const stripeSub = await (await getStripe()).subscriptions.retrieve(subscription.stripeSubId) as any
        stripeStatus = stripeSub.status.toUpperCase()
        
        // Sync with Stripe status
         if (!['ACTIVE', 'TRIALING'].includes(stripeStatus) && subscription.isActive) {
          await prisma.brokerSubscription.update({
            where: { brokerId },
            data: { isActive: false }
          })
        }
      } catch (error) {
        console.error('Error fetching Stripe subscription:', error)
      }
    }

    const effective = this.effectiveSubscription(subscription.isActive && stripeStatus === 'ACTIVE' ? subscription : { ...subscription, isActive: false })
    return {
      ...effective,
      stripeCustomerId: subscription.stripeCustomerId,
      stripeSubId: subscription.stripeSubId,
      status: stripeStatus
    }
  }

  // Apply commercial placement only. Ownership, verification, and visibility
  // are independent profile/account concerns.
  static async applySubscriptionFeatures(brokerId: string) {
    const broker = await prisma.broker.findUnique({
      where: { id: brokerId },
      include: { subscription: true }
    })

    if (!broker) {
      throw new Error('Broker not found')
    }

    const subscription = this.effectiveSubscription(broker.subscription)
    const plan = subscription.plan
    const isActive = subscription.isActive
    const isPaidPlan = plan === 'FEATURED'
    const updates = {
      featuredRank: isActive && isPaidPlan
        ? this.calculateFeaturedRank(broker, plan)
        : null,
    }

    await prisma.broker.update({
      where: { id: brokerId },
      data: updates
    })

    return updates
  }

  // Calculate featured rank
  static calculateFeaturedRank(broker: any, plan: string): number {
    let rank = 0

    // Base rank from subscription
    if (plan === 'FEATURED') {
      rank += 50
    }

    // Rating bonus (0-30 points)
    rank += Math.min(Math.floor(broker.avgRating * 6), 30)

    // Review count bonus (0-20 points)
    rank += Math.min(Math.floor(broker.totalReviews / 5), 20)

    // Experience bonus (0-15 points)
    rank += Math.min(Math.floor(broker.experienceYears / 2), 15)

    // Lead conversion bonus (0-15 points)
    const convertedLeads = broker.leads?.filter((l: any) => l.status === 'CONVERTED').length || 0
    const conversionRate = broker.totalLeads > 0 
      ? convertedLeads / broker.totalLeads 
      : 0
    rank += Math.min(Math.floor(conversionRate * 15), 15)

    return rank
  }

  // Get usage statistics
  static async getUsageStats(brokerId: string) {
    const broker = await prisma.broker.findUnique({
      where: { id: brokerId },
      include: {
        subscription: { include: { planRef: true } },
        bankPartners: true,
   
        contactMessages: {
          where: {
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            }
          }
        },
        reviews: true
      }
    })

    if (!broker) {
      throw new Error('Broker not found')
    }

    const subscription = this.effectiveSubscription(broker.subscription)
    const plan = subscription.plan

    // Current plan display info is derived from the database plan, never the
    // static catalog.
    const publicPlans = await listBrokerPlansPublic()
    const planInfo = publicPlans.find((p) => p.code === plan) || null

    return {
      usage: {
        bankPartners: broker.bankPartners.length,
        contactMessages: broker.contactMessages.length,
        profileViews: broker.profileViews,
        totalLeads: broker.totalLeads,
        reviews: broker.totalReviews,
  
        teamMembers: 1, // Default, can be expanded
        branches: 1 // Default, can be expanded
      },
      planInfo,
      plan,
      isActive: subscription.isActive
    }
  }

  // Check if can upgrade
  static async canUpgrade(brokerId: string, targetPlan: string) {
    const broker = await prisma.broker.findUnique({
      where: { id: brokerId },
      include: { subscription: true }
    })

    if (!broker) {
      return { canUpgrade: false, reason: 'Broker not found' }
    }

    const currentPlan = this.effectiveSubscription(broker.subscription).plan
    // Plan ordering comes from the database (displayOrder), not a static catalog.
    const plans = await prisma.brokerSubscriptionPlan.findMany({ select: { code: true, displayOrder: true } })
    const orderOf = (code: string) => {
      const match = plans.find((p) => p.code === code)
      return match ? match.displayOrder : Number.MAX_SAFE_INTEGER
    }
    const currentOrder = orderOf(currentPlan)
    const targetOrder = orderOf(targetPlan)

    if (targetOrder <= currentOrder) {
      return { canUpgrade: false, reason: 'Target plan is not higher than current plan' }
    }

    return { canUpgrade: true }
  }

  // Update subscription in Stripe and database
  static async updateSubscriptionFromStripe(
    stripeCustomerId: string,
    stripeSubscriptionId: string,
    status: string,
    planId?: string,
    ownerType?: string | null,
  ) {
    // Cross-product isolation: when the Stripe event carries an explicit
    // ownerType, route to exactly one product's subscription model. This
    // guarantees a COMPANY event can never mutate a BrokerSubscription (and
    // vice versa). Legacy events without ownerType fall back to the historical
    // customer-id dispatch.
    if (ownerType === 'COMPANY') {
      const companySubscription = await this.updateCompanySubscriptionFromStripe(
        stripeCustomerId,
        stripeSubscriptionId,
        status,
        planId,
      )
      if (!companySubscription) throw new Error('Company subscription not found')
      return companySubscription
    }
    if (ownerType === 'BROKER_REGISTRATION') {
      const registrationSubscription = await this.updateRegistrationSubscriptionFromStripe(
        stripeCustomerId,
        stripeSubscriptionId,
        status,
        planId,
      )
      if (!registrationSubscription) throw new Error('Broker registration subscription not found')
      return registrationSubscription
    }

    // Find broker by Stripe customer ID
    const subscription = await prisma.brokerSubscription.findFirst({
      where: { stripeCustomerId },
      include: { broker: true }
    })

    // Ownership resolution for a BROKER-typed or ownerType-less (legacy) event.
    //
    // Explicit BROKER: never fall through to another product — the customer
    // must resolve to a BrokerSubscription or the event is rejected.
    //
    // Legacy ownerType-less events (created before ownerType metadata existed):
    // resolve the owning product strictly instead of silently choosing the
    // first match. The same Stripe customer must map to at most one product;
    // if the customer is ambiguous across products, or belongs to no known
    // product, the event is rejected rather than mutating the wrong row. A
    // safe diagnostic (no secrets) is logged for post-hoc analysis.
    if (!subscription) {
      // Explicit BROKER never falls through to another product.
      if (ownerType === 'BROKER') throw new Error('Broker subscription not found')
      const [brokerSubscription, registrationSubscription, companySubscription] = await Promise.all([
        prisma.brokerSubscription.findFirst({ where: { stripeCustomerId }, select: { id: true } }),
        prisma.brokerRegistrationSubscription.findFirst({ where: { stripeCustomerId }, select: { id: true } }),
        prisma.companySubscription.findFirst({ where: { stripeCustomerId }, select: { id: true } }),
      ])
      const matches = Number(Boolean(brokerSubscription)) + Number(Boolean(registrationSubscription)) + Number(Boolean(companySubscription))
      if (matches > 1) {
        console.warn('Stripe webhook ownerType-less event matched multiple products; refusing ambiguous mutation', { stripeCustomerId })
        throw new Error('Ambiguous Stripe customer ownership')
      }
      if (registrationSubscription) {
        return this.updateRegistrationSubscriptionFromStripe(stripeCustomerId, stripeSubscriptionId, status, planId) as any
      }
      if (companySubscription) {
        return this.updateCompanySubscriptionFromStripe(stripeCustomerId, stripeSubscriptionId, status, planId) as any
      }
      throw new Error('Broker subscription not found')
    }
    if (subscription.stripeSubId && subscription.stripeSubId !== stripeSubscriptionId) {
      const currentStripeSubscription = await (await getStripe()).subscriptions.retrieve(subscription.stripeSubId)
      const incomingIsActive = status === 'active' || status === 'trialing'
      const currentIsTerminal = ['canceled', 'incomplete_expired'].includes(currentStripeSubscription.status)
      const currentIsActive = ['active', 'trialing', 'incomplete', 'past_due', 'unpaid', 'paused'].includes(currentStripeSubscription.status)
      if (currentIsActive || !currentIsTerminal || !incomingIsActive) {
        if (currentIsActive && !incomingIsActive) return subscription
        throw new Error('Stripe subscription does not match Broker subscription')
      }
    }

    const isActive = status === 'active' || status === 'trialing'

    // Get plan from Stripe metadata or price. The database plan is
    // authoritative; the legacy static resolution is a fallback.
    const resolved = await resolvePlanForStripePrice(String(planId || ''))

    // Update subscription in database
    const updatedSubscription = await prisma.brokerSubscription.update({
      where: { id: subscription.id },
      data: {
        plan: resolved.code,
        planId: resolved.id,
        isActive,
        
        stripeSubId: stripeSubscriptionId,
        endDate: isActive ? null : new Date(),
        updatedAt: new Date()
      }
    })

    // Apply subscription features to broker
    await this.applySubscriptionFeatures(subscription.brokerId)

    return updatedSubscription
  }

  static async updateRegistrationSubscriptionFromStripe(
    stripeCustomerId: string,
    stripeSubscriptionId: string,
    status: string,
    planId?: string,
  ) {
    const registrationSubscription = await prisma.brokerRegistrationSubscription.findFirst({
      where: { stripeCustomerId },
      include: { registration: true },
    })
    if (!registrationSubscription) return null

    const isActive = status === 'active' || status === 'trialing'
    const plan = (await getPlanForStripePrice(planId)) as SubscriptionPlan
    const registrationStatus = isActive ? 'ONBOARDING_IN_PROGRESS' : registrationSubscription.registration.status
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.brokerRegistrationSubscription.update({
        where: { id: registrationSubscription.id },
        data: {
          plan,
          status: isActive ? 'ACTIVE' : status === 'canceled' ? 'CANCELED' : 'EXPIRED',
          isActive,
          stripeSubId: stripeSubscriptionId,
          startDate: isActive ? new Date() : registrationSubscription.startDate,
          endDate: isActive ? null : new Date(),
          updatedAt: new Date(),
        },
      })
      await tx.brokerRegistration.update({
        where: { id: registrationSubscription.registrationId },
        data: { status: registrationStatus },
      })
      return result
    })
    return updated
  }

  // Reconciles an abandoned (expired) Company Checkout Session. A company
  // subscription that is still CHECKOUT_PENDING with no live Stripe
  // subscription is moved to the neutral terminal EXPIRED state so it never
  // permanently misrepresents an abandoned payment. This is safe by design:
  //  - only a CHECKOUT_PENDING row is ever touched,
  //  - a row that already advanced (ACTIVE / PAST_DUE / ...) is never modified,
  //  - an existing live (non-terminal) Stripe subscription is never cancelled
  //    merely because a Checkout Session expired — the session is unrelated,
  //  - a late `checkout.session.completed` / `customer.subscription.*` webhook
  //    can still establish ACTIVE afterwards because it writes unconditionally.
  // Is active/must be idempotent; repeated calls converge to the same result.
  static async reconcileCompanyCheckoutExpired(
    stripeCustomerId: string,
    ownerType?: string | null,
    metadata?: { companyId?: string | null } | null,
  ) {
    // Cross-product isolation: only a COMPANY event may reconcile a company row.
    if (ownerType && ownerType !== 'COMPANY') throw new Error('Stripe event ownerType does not belong to the company product')
    const existing = await prisma.companySubscription.findFirst({ where: { stripeCustomerId } })
    if (!existing) return { reconciled: false, reason: 'no-company-subscription' }
    if (existing.status !== 'CHECKOUT_PENDING') return { reconciled: false, reason: 'already-advanced' }
    if (metadata?.companyId && existing.companyId !== metadata.companyId) {
      throw new Error('Stripe checkout session does not belong to this company')
    }

    // Rule 7: never expire a pending row that already corresponds to a live
    // Stripe subscription (an unrelated abandoned session must not affect it).
    let liveSubscription = false
    if (existing.stripeSubId) {
      const subs = await (await getStripe()).subscriptions.list({ customer: stripeCustomerId, status: 'all', limit: 20 })
      liveSubscription = subs.data.some((s) =>
        ['active', 'trialing', 'incomplete', 'past_due', 'unpaid', 'paused'].includes(s.status),
      )
    }
    if (liveSubscription) return { reconciled: false, reason: 'live-subscription-present' }

    await prisma.companySubscription.update({
      where: { id: existing.id },
      data: { status: 'EXPIRED', isActive: false, endDate: existing.endDate ?? new Date(), updatedAt: new Date() },
    })
    return { reconciled: true }
  }

  // Bounded stale-checkout reconciliation invoked at the point of a fresh
  // checkout for the SAME company (never a full-DB scan). If the company's row
  // is CHECKOUT_PENDING but no checkout session is actually open and no live
  // subscription exists, it is reconciled to EXPIRED so a fresh checkout is
  // not misrepresented. Always idempotent; never touches ACTIVE state.
  static async reconcileStaleCompanyCheckout(companyId: string, customerId: string | null) {
    const existing = await prisma.companySubscription.findUnique({ where: { companyId } })
    if (!existing || existing.status !== 'CHECKOUT_PENDING') return { reconciled: false, reason: 'not-pending' }
    if (existing.stripeSubId) {
      const subs = await (await getStripe()).subscriptions.list({ customer: customerId ?? existing.stripeCustomerId ?? '', status: 'all', limit: 20 })
      const live = subs.data.some((s) =>
        ['active', 'trialing', 'incomplete', 'past_due', 'unpaid', 'paused'].includes(s.status),
      )
      if (live) return { reconciled: false, reason: 'live-subscription-present' }
    }
    await prisma.companySubscription.update({
      where: { id: existing.id },
      data: { status: 'EXPIRED', isActive: false, endDate: existing.endDate ?? new Date(), updatedAt: new Date() },
    })
    return { reconciled: true }
  }

  // Controlled CompanyAdvertisingPlan deactivation: "Deactivate plan and cancel
  // active subscriptions".
  //
  // Selection of behavior — IMMEDIATE cancellation. The existing company
  // cancellation path (app/api/company/subscription/cancel) calls
  // subscriptions.cancel immediately, so plan deactivation uses the same
  // canonical immediate cancellation semantics for consistency. This means paid
  // access is removed once the plan is deactivated (reconciled via the cancel
  // webhook / local reconcile). Plan deactivation never silently leaves access
  // in place.
  //
  // Orchestration (Stripe API calls are external side effects, so this is NOT
  // wrapped in a single DB transaction):
  //   1. Lock the plan operation so concurrent deactivations are serialized.
  //   2. Load the plan and its active CompanySubscriptions (the FK from
  //      CompanySubscription.advertisingPlan to CompanyAdvertisingPlan
  //      guarantees every row belongs to the Company Advertising product).
  //   3. For each subscription, verify ownership against its Stripe customer
  //      then cancel with a deterministic idempotency key, and reconcile local
  //      state from the response.
  //   4. Only after every active subscription is cancelled, deactivate the plan.
  //   5. If any cancellation fails, the plan is LEFT ACTIVE and errors report
  //      the failed company subscription IDs, making retry safe and resumable.
  //   6. Never deletes the plan, the Stripe Product, or the Stripe Price.
  static async deactivateCompanyAdvertisingPlan(planId: string): Promise<{ deactivated: boolean; cancelledSubscriptions: number }> {
    return this.withBillingLock(`company-plan:${planId}`, async () => {
      const plan = await prisma.companyAdvertisingPlan.findUnique({
        where: { id: planId },
        include: { subscriptions: { where: { isActive: true } } },
      })
      if (!plan) throw new Error('Plan not found')
      if (!plan.isActive) return { deactivated: false, cancelledSubscriptions: 0 }

      const activeSubscriptions = plan.subscriptions
      const failedIds: string[] = []

      for (const sub of activeSubscriptions) {
        if (!sub.stripeSubId || !sub.stripeCustomerId) {
          // Local-only / not yet on Stripe (e.g. stale CHECKOUT_PENDING) — no
          // remote cancellation to perform; reconcile locally so the plan can
          // be deactivated. This row is not active on Stripe, so nothing real
          // is cancelled.
          if (sub.status === 'CHECKOUT_PENDING') {
            await prisma.companySubscription.update({
              where: { id: sub.id },
              data: { status: 'EXPIRED', isActive: false, updatedAt: new Date() },
            })
          }
          continue
        }
        try {
          const stripe = await getStripe()
          const remote = await stripe.subscriptions.retrieve(sub.stripeSubId)
          // Ownership: the Stripe customer must own the subscription AND belong
          // to this company. If the customer metadata disagrees, refuse.
          if (remote.customer !== sub.stripeCustomerId) {
            failedIds.push(sub.id)
            continue
          }
          const customer = await stripe.customers.retrieve(sub.stripeCustomerId)
          if ('deleted' in customer && customer.deleted) {
            failedIds.push(sub.id)
            continue
          }
          if (customer.metadata?.companyId && customer.metadata.companyId !== sub.companyId) {
            failedIds.push(sub.id)
            continue
          }
          await stripe.subscriptions.cancel(remote.id, {}, { idempotencyKey: `company_plan_deactivate_${planId}_${remote.id}` })
          await this.updateCompanySubscriptionFromStripe(sub.stripeCustomerId, remote.id, 'canceled')
        } catch (error) {
          console.error('Company plan deactivation cancellation failed', { planId, companySubscriptionId: sub.id, error: error instanceof Error ? error.message : 'Unknown error' })
          failedIds.push(sub.id)
        }
      }

      if (failedIds.length > 0) {
        throw new PlanDeactivationError(
          'Some active subscriptions could not be cancelled. The plan was not deactivated. Please resolve the failures and retry.',
          failedIds,
        )
      }

      await prisma.companyAdvertisingPlan.update({ where: { id: planId }, data: { isActive: false } })
      return { deactivated: true, cancelledSubscriptions: activeSubscriptions.length }
    })
  }

  static async updateCompanySubscriptionFromStripe(
    stripeCustomerId: string,
    stripeSubscriptionId: string,
    status: string,
    priceId?: string | null,
  ) {
    const existing = await prisma.companySubscription.findFirst({ where: { stripeCustomerId } })
    if (!existing) return null
    const plan = priceId ? await resolveCompanyPlanByStripePrice(priceId) : null
    const mapped = mapCompanySubscriptionStatus(status)
    const isActive = mapped.isActive
    return prisma.$transaction(async (tx) => {
      const updated = await tx.companySubscription.update({
        where: { id: existing.id },
        data: {
          status: mapped.status,
          isActive,
          stripeSubId: stripeSubscriptionId,
          planId: plan ? plan.id : existing.planId,
          plan: plan ? plan.name : existing.plan,
          startDate: isActive ? existing.startDate || new Date() : existing.startDate,
          endDate: isActive ? null : new Date(),
          updatedAt: new Date(),
        },
      })
      if (isActive) await tx.company.update({ where: { id: existing.companyId }, data: { status: 'ACTIVE' } })
      return updated
    })
  }

  // Cancel subscription
  static async cancelSubscription(brokerId: string) {
    return this.withCheckoutLock(brokerId, async () => {
      const subscription = await prisma.brokerSubscription.findUnique({
      where: { brokerId }
      })

    if (!subscription?.stripeSubId) {
      // Just mark as inactive in database
      await prisma.brokerSubscription.update({
        where: { brokerId },
        data: {
          isActive: false,
          endDate: new Date()
        }
      })
    } else {
      // Cancel in Stripe
      try {
        await (await getStripe()).subscriptions.cancel(subscription.stripeSubId, {}, {
          idempotencyKey: `cancel_${subscription.stripeCustomerId}_${subscription.stripeSubId}`,
        }) as any
      } catch (error) {
        console.error('Error canceling Stripe subscription:', error)
        throw new Error('Stripe cancellation failed')
      }

      await prisma.brokerSubscription.update({
        where: { brokerId },
        data: {
          isActive: false,
          endDate: new Date()
        }
      })
    }

    // Apply subscription features (will reset to free)
    await this.applySubscriptionFeatures(brokerId)

      return { success: true }
    })
  }

  // Sync with Stripe
  static async syncWithStripe(brokerId: string) {
    const subscription = await prisma.brokerSubscription.findUnique({
      where: { brokerId }
    })

    if (!subscription?.stripeSubId) {
      return { success: false, message: 'No Stripe subscription found' }
    }

    try {
      const stripeSub = await (await getStripe()).subscriptions.retrieve(subscription.stripeSubId) as any
      if (stripeSub.customer !== subscription.stripeCustomerId) {
        return { success: false, message: 'Stripe customer does not match Broker subscription' }
      }

      const isActive = stripeSub.status === 'active' || stripeSub.status === 'trialing'
      const resolved = await resolvePlanForStripePrice(stripeSub.items.data[0]?.price.id || '')

      // Update database with Stripe status
      await prisma.brokerSubscription.update({
        where: { brokerId },
        data: {
          plan: isActive ? resolved.code : 'FREE',
          planId: isActive ? resolved.id : null,
          isActive,
          endDate: isActive ? null : new Date(),
          updatedAt: new Date()
        }
      })

      // Apply subscription features
      await this.applySubscriptionFeatures(brokerId)

      return { success: true, status: stripeSub.status }
    } catch (error) {
      console.error('Error syncing with Stripe:', error)
      return { success: false, message: 'Failed to sync with Stripe' }
    }
  }
}
