/* eslint-disable @typescript-eslint/no-explicit-any */
import { SubscriptionPlan } from '@prisma/client'
import Stripe from 'stripe'
import crypto from 'crypto'
import { Redis } from '@upstash/redis'
import prisma from '@/lib/prisma'
import { getAuthoritativePlan, subscriptionPlans } from '@/lib/stripe'
import { resolveCompanyPlanByStripePrice } from '@/lib/company-plan'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // apiVersion: '2024-06-20',
})

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

export function getPlanForStripePrice(priceId: unknown): SubscriptionPlan {
  return subscriptionPlans.find((plan) => plan.stripePriceId === priceId)?.name === 'FEATURED'
    ? 'FEATURED'
    : 'FREE'
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
    const customer = await stripe.customers.retrieve(customerId)
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
    const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 20 })
    const blockingSubscription = subscriptions.data.find((subscription) =>
      ['active', 'trialing', 'incomplete', 'past_due', 'unpaid', 'paused'].includes(subscription.status),
    )
    if (blockingSubscription) {
      return { reason: 'An existing subscription must be managed before another checkout.' }
    }
    const sessions = await stripe.checkout.sessions.list({ customer: customerId, status: 'open', limit: 20 })
    const openSession = sessions.data.find((session) => session.mode === 'subscription')
    if (openSession?.url) return { checkoutUrl: openSession.url }
    return null
  }

  static effectiveSubscription(subscription: { plan: SubscriptionPlan; isActive: boolean; startDate?: Date; endDate?: Date | null; stripeCustomerId?: string | null; stripeSubId?: string | null } | null) {
    const expired = Boolean(subscription?.endDate && subscription.endDate <= new Date())
    if (!subscription || subscription.plan === 'FREE' || subscription.plan !== 'FEATURED' || !subscription.isActive || expired) {
      return {
        plan: 'FREE' as SubscriptionPlan,
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
        const stripeSub = await stripe.subscriptions.retrieve(subscription.stripeSubId) as any
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
  static calculateFeaturedRank(broker: any, plan: SubscriptionPlan): number {
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
        subscription: true,
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
    const planConfig = getAuthoritativePlan(plan) || subscriptionPlans[0]

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
      limits: planConfig.limits,
      plan,
      isActive: subscription.isActive
    }
  }

  // Check if can upgrade
  static async canUpgrade(brokerId: string, targetPlan: SubscriptionPlan) {
    const broker = await prisma.broker.findUnique({
      where: { id: brokerId },
      include: { subscription: true }
    })

    if (!broker) {
      return { canUpgrade: false, reason: 'Broker not found' }
    }

    const currentPlan = this.effectiveSubscription(broker.subscription).plan
    const currentPlanIndex = subscriptionPlans.findIndex(p => p.name === currentPlan)
    const targetPlanIndex = subscriptionPlans.findIndex(p => p.name === targetPlan)

    if (targetPlanIndex <= currentPlanIndex) {
      return { canUpgrade: false, reason: 'Target plan is not higher than current plan' }
    }

    return { canUpgrade: true }
  }

  // Update subscription in Stripe and database
  static async updateSubscriptionFromStripe(
    stripeCustomerId: string,
    stripeSubscriptionId: string,
    status: string,
    planId?: string
  ) {
    // Find broker by Stripe customer ID
    const subscription = await prisma.brokerSubscription.findFirst({
      where: { stripeCustomerId },
      include: { broker: true }
    })

    if (!subscription) {
      const registrationSubscription = await this.updateRegistrationSubscriptionFromStripe(
        stripeCustomerId,
        stripeSubscriptionId,
        status,
        planId,
      )
      if (registrationSubscription) return registrationSubscription as any
      const companySubscription = await this.updateCompanySubscriptionFromStripe(
        stripeCustomerId,
        stripeSubscriptionId,
        status,
        planId,
      )
      if (companySubscription) return companySubscription as any
      throw new Error('Broker subscription not found')
    }
    if (subscription.stripeSubId && subscription.stripeSubId !== stripeSubscriptionId) {
      const currentStripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubId)
      const incomingIsActive = status === 'active' || status === 'trialing'
      const currentIsTerminal = ['canceled', 'incomplete_expired'].includes(currentStripeSubscription.status)
      const currentIsActive = ['active', 'trialing', 'incomplete', 'past_due', 'unpaid', 'paused'].includes(currentStripeSubscription.status)
      if (currentIsActive || !currentIsTerminal || !incomingIsActive) {
        if (currentIsActive && !incomingIsActive) return subscription
        throw new Error('Stripe subscription does not match Broker subscription')
      }
    }

    const isActive = status === 'active' || status === 'trialing'

    // Get plan from Stripe metadata or price
    const plan = getPlanForStripePrice(planId)

    // Update subscription in database
    const updatedSubscription = await prisma.brokerSubscription.update({
      where: { id: subscription.id },
      data: {
        plan,
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
    const plan = getPlanForStripePrice(planId)
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

  static async updateCompanySubscriptionFromStripe(
    stripeCustomerId: string,
    stripeSubscriptionId: string,
    status: string,
    priceId?: string | null,
  ) {
    const existing = await prisma.companySubscription.findFirst({ where: { stripeCustomerId } })
    if (!existing) return null
    const plan = priceId ? await resolveCompanyPlanByStripePrice(priceId) : null
    const isActive = status === 'active' || status === 'trialing'
    return prisma.$transaction(async (tx) => {
      const updated = await tx.companySubscription.update({
        where: { id: existing.id },
        data: {
          status: isActive ? 'ACTIVE' : status === 'past_due' ? 'PAST_DUE' : status === 'canceled' ? 'CANCELED' : 'EXPIRED',
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
        await stripe.subscriptions.cancel(subscription.stripeSubId, {}, {
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
      const stripeSub = await stripe.subscriptions.retrieve(subscription.stripeSubId) as any
      if (stripeSub.customer !== subscription.stripeCustomerId) {
        return { success: false, message: 'Stripe customer does not match Broker subscription' }
      }

      const isActive = stripeSub.status === 'active' || stripeSub.status === 'trialing'

      // Update database with Stripe status
      await prisma.brokerSubscription.update({
        where: { brokerId },
        data: {
          plan: isActive ? getPlanForStripePrice(stripeSub.items.data[0]?.price.id) : 'FREE',
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
