/**
 * Company Advertising Plan definitions for seeding.
 *
 * Completely separate from broker subscription plans.
 *
 * The product exposes EXACTLY ONE customer-facing active company advertising
 * plan ('ADVERTISING'). The seed creates this single canonical plan; legacy
 * tier rows are never seeded. Stripe identifiers come from environment
 * configuration (STRIPE_COMPANY_AD_PRODUCT_ID / STRIPE_COMPANY_AD_PRICE_ID) —
 * the checkout resolves the authoritative Stripe price from the database plan,
 * never a hardcoded value.
 */

// Customer-facing display name for the canonical company advertising plan.
export const COMPANY_PLAN_DISPLAY_NAME: Record<string, string> = {
  ADVERTISING: 'Advertising',
}

// The single canonical company advertising plan.
export const DEFAULT_COMPANY_PLANS: Array<{
  name: string
  description: string
  price: number // in cents
  billingInterval: string
  currency: string
  displayOrder: number
  isActive: boolean
  stripeProductId?: string
  stripePriceId?: string
  features: string[]
}> = [
  {
    name: 'ADVERTISING',
    description: 'Company advertising subscription with campaign and ad-request access.',
    price: 4900, // $49/month initial seed price (authoritative value lives in the DB row)
    billingInterval: 'month',
    currency: 'usd',
    displayOrder: 10,
    isActive: true,
    stripeProductId: process.env.STRIPE_COMPANY_AD_PRODUCT_ID || undefined,
    stripePriceId: process.env.STRIPE_COMPANY_AD_PRICE_ID || undefined,
    features: ['advertising request access', 'location and radius targeting', 'admin review'],
  },
]

export function getCompanyPlanDisplayName(name: string): string {
  return COMPANY_PLAN_DISPLAY_NAME[name] || name
}