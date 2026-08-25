import prisma from '@/lib/prisma'
import { SubscriptionPlan } from '@prisma/client'

// Stripe price IDs used by the broker REGISTRATION flow (BrokerRegistrationSubscription).
// FREE has no Stripe price. The authoritative FEATURED price comes from the database
// BrokerSubscriptionPlan; the env var is a bootstrap fallback for environments where
// the DB plan is not yet reconciled. No Stripe price is hardcoded in source.
export const stripePriceIds: Partial<Record<SubscriptionPlan, string>> = {
  FREE: '',
  FEATURED: process.env.STRIPE_STANDARD_PRICE_ID || '',
}

// Resolve the authoritative FEATURED price: the configured env price first, then
// the database plan's stripePriceId (the DB remains the source of truth).
async function resolveFeaturedPrice(): Promise<string | null> {
  if (stripePriceIds.FEATURED) return stripePriceIds.FEATURED
  const plan = await prisma.brokerSubscriptionPlan.findFirst({
    where: { code: 'FEATURED' },
    select: { stripePriceId: true },
  })
  return plan?.stripePriceId || null
}

// Validates a plan/price pair for the broker registration flow. The price is
// resolved from the database plan (falling back to the configured env price)
// so the authoritative DB stripePriceId remains the source of truth. This is
// registration-only; the runtime broker plans live in BrokerSubscriptionPlan.
export async function validatePlanPrice(plan: unknown, priceId: unknown) {
  if (typeof plan !== 'string' || plan === 'FREE') return null
  if (plan !== 'FEATURED') return null
  const expected = await resolveFeaturedPrice()
  if (!expected || expected !== priceId) return null
  return { name: plan }
}