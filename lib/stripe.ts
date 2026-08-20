import { SubscriptionPlan } from '@prisma/client'

// Stripe price IDs used by the broker REGISTRATION flow (BrokerRegistrationSubscription),
// which intentionally remains separate from the DB-backed BrokerSubscriptionPlan system.
// FREE has no Stripe price. FEATURED references the configured standard price.
export const stripePriceIds: Partial<Record<SubscriptionPlan, string>> = {
  FREE: '',
  FEATURED: process.env.STRIPE_STANDARD_PRICE_ID || 'price_1SnbRGGVtFf86pD1V5PHIzPe',
}

// Validates a plan/price pair for the broker registration flow. This is the
// only static plan/price check that remains, and it is registration-only.
// The authoritative runtime broker plans live in BrokerSubscriptionPlan.
export function validatePlanPrice(plan: unknown, priceId: unknown) {
  if (typeof plan !== 'string' || plan === 'FREE') return null
  const expected = stripePriceIds[plan as SubscriptionPlan]
  if (!expected || expected !== priceId) return null
  return { name: plan }
}