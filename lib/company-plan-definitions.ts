/**
 * Company Advertising Plan definitions for seeding.
 * 
 * These define the initial company advertising plans.
 * Completely separate from broker subscription plans.
 * 
 * Company plans use Stripe Price IDs for checkout.
 * Free plans can optionally not require Stripe configuration.
 */



// Customer-facing display names
export const COMPANY_PLAN_DISPLAY_NAME: Record<string, string> = {
  STARTER: 'Starter',
  PROFESSIONAL: 'Professional', 
  ENTERPRISE: 'Enterprise',
}

// Default company advertising plans
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
    name: 'Starter',
    description: 'Get started with advertising',
    price: 4900, // $49/month
    billingInterval: 'month',
    currency: 'usd',
    displayOrder: 10,
    isActive: true,
    features: ['Basic Listing', '5 Ad Requests/month', 'Email Support'],
  },
  {
    name: 'Professional', 
    description: 'Grow your reach with advanced tools',
    price: 14900, // $149/month
    billingInterval: 'month', 
    currency: 'usd',
    displayOrder: 20,
    isActive: true,
    features: ['Enhanced Listing', '25 Ad Requests/month', 'Priority Support', 'Analytics Dashboard'],
  },
  {
    name: 'Enterprise',
    description: 'Maximum visibility and dedicated support',
    price: 49900, // $499/month
    billingInterval: 'month',
    currency: 'usd',
    displayOrder: 30,
    isActive: true,
    features: ['Premium Listing', 'Unlimited Ad Requests', 'Dedicated Account Manager', 'Custom Analytics', 'API Access'],
  },
]

export function getCompanyPlanDisplayName(name: string): string {
  return COMPANY_PLAN_DISPLAY_NAME[name] || name
}
