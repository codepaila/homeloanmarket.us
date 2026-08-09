/* eslint-disable @typescript-eslint/no-explicit-any */
import { SubscriptionPlan } from '@prisma/client'
import Stripe from 'stripe'
import prisma from '@/lib/prisma'
import { getAuthoritativePlan, subscriptionPlans } from '@/lib/stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // apiVersion: '2024-06-20',
})

export function getPlanForStripePrice(priceId: unknown): SubscriptionPlan {
  return subscriptionPlans.find((plan) => plan.stripePriceId === priceId)?.name === 'FEATURED'
    ? 'FEATURED'
    : 'FREE'
}

export class SubscriptionService {
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
      throw new Error('Broker subscription not found')
    }
    if (subscription.stripeSubId && subscription.stripeSubId !== stripeSubscriptionId) {
      throw new Error('Stripe subscription does not match Broker subscription')
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

  // Cancel subscription
  static async cancelSubscription(brokerId: string) {
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
        await stripe.subscriptions.cancel(subscription.stripeSubId) as any
      } catch (error) {
        console.error('Error canceling Stripe subscription:', error)
        // Still mark as inactive in our database
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
