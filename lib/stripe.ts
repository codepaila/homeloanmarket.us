
import { SubscriptionPlan } from '@prisma/client'


// Stripe price IDs for each plan (you need to set these in your Stripe dashboard)
export const stripePriceIds: Partial<Record<SubscriptionPlan, string>> = {
  FREE: '',
  FEATURED: process.env.STRIPE_STANDARD_PRICE_ID || 'price_1SnbRGGVtFf86pD1V5PHIzPe',
}


// Subscription plans for broker profile listing platform
export const subscriptionPlans = [
  {
    name: 'FREE',
    description: 'Basic broker listing',
    price: 0,
    features: [
      'Basic profile listing',
      'Basic analytics'
      // 'Contact form (no direct contact)',
      // 'Up to 3 bank partnerships',
      // 'Receive leads via platform',
      // 'Email support (72h response)',
    ],
    limits: {
      // maxBankPartners: 3,
      canShowContact: false,
      isFeatured: false,
      prioritySupport: false,
      advancedAnalytics: false,
      maxActiveListings: 5,
      maxTeamMembers: 1,
      maxBranches: 1,
    }
  },
  {
    name: 'FEATURED',
    description: 'Get featured in listings and direct leads',
    price: 99, // ₹99/month
    stripePriceId: stripePriceIds.FEATURED,
    features: [
      'Featured in search results (priority ranking)',
      'Direct contact details shown',
      // 'Up to 10 bank partnerships',
      'Priority email support (24h response)',
      'Advanced analytics dashboard',
      // 'Lead management tools'
    ],
    limits: {
      // maxBankPartners: 10,
      canShowContact: true,
      isFeatured: true,
      prioritySupport: true,
      advancedAnalytics: true,
      customProfile: true,
      phoneSupport: true,
      maxActiveListings: 50,
      maxTeamMembers: 5,
      maxBranches: 3,
    }
  },
]

export function getAuthoritativePlan(plan: unknown) {
  if (typeof plan !== 'string') return null
  return subscriptionPlans.find((config) => config.name === plan) || null
}

export function validatePlanPrice(plan: unknown, priceId: unknown) {
  const config = getAuthoritativePlan(plan)
  if (!config || config.name === 'FREE' || !config.stripePriceId || config.stripePriceId !== priceId) return null
  return config
}

// Get plan configuration
export function getPlanConfig(plan: SubscriptionPlan) {
  return subscriptionPlans.find(p => p.name === plan) || subscriptionPlans[0]
}

// Check if broker can access feature
export function canAccessFeature(
  subscription: { plan: SubscriptionPlan; isActive: boolean } | null,
  feature: keyof typeof subscriptionPlans[0]['limits']
): boolean | number {
  const effective = !subscription || subscription.plan === 'FREE' || !subscription.isActive
    ? { plan: 'FREE' as SubscriptionPlan, isActive: true }
    : subscription
  const planConfig = getPlanConfig(effective.plan)
  return planConfig.limits[feature] || false
}

// Calculate featured rank based on subscription
export function calculateFeaturedRank(
  subscription: { plan: SubscriptionPlan; isActive: boolean } | null,
  avgRating: number,
  totalReviews: number
): number {
  if (!subscription || !subscription.isActive) {
    return 0
  }
  
  let rank = 0
  
  // Base rank from subscription
  if (subscription.plan === 'FEATURED') {
    rank += 50
  }
  
  // Add rating bonus
  rank += Math.floor(avgRating * 10)
  
  // Add review count bonus (diminishing returns)
  rank += Math.min(Math.floor(totalReviews / 10), 20)
  
  return rank
}
