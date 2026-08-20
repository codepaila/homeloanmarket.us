import prisma from '@/lib/prisma'
import { validateStripeProductId, validateStripePriceId } from '@/lib/broker-plans'

// Company advertising plan management helpers. These are separate from broker
// plans; companies have their own billing domain (CompanySubscription →
// CompanyAdvertisingPlan) and must never share a plan model with brokers.

export type CompanyPlanStats = {
  activeSubscribers: number
  historicalSubscriptions: number
  adRequests: number
}

export async function getCompanyPlanStats(planId: string): Promise<CompanyPlanStats> {
  const [activeSubscribers, historicalSubscriptions, adRequests] = await Promise.all([
    prisma.companySubscription.count({ where: { planId, isActive: true } }),
    prisma.companySubscription.count({ where: { planId } }),
    prisma.companyAdRequest.count({ where: { company: { subscription: { planId } } } }),
  ])
  return { activeSubscribers, historicalSubscriptions, adRequests }
}

export function formatPlanPrice(priceCents: number, currency: string) {
  const value = priceCents / 100
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'usd' }).format(value)
  } catch {
    return `$${value}`
  }
}

export type CompanyPlanValidationResult =
  | { ok: true }
  | { ok: false; message: string }

// Validates the Stripe identifiers for a paid plan. FREE plans (price 0) may
// omit Stripe identifiers. Paid plans must reference valid, matching Stripe
// Product and Price IDs.
export async function validateCompanyPlanStripe(input: {
  price: number
  stripeProductId?: string | null
  stripePriceId?: string | null
}): Promise<CompanyPlanValidationResult> {
  const isPaid = input.price > 0
  const productId = input.stripeProductId?.trim() || null
  const priceId = input.stripePriceId?.trim() || null

  if (!isPaid) {
    // FREE plan: no Stripe identifiers required.
    return { ok: true }
  }

  if (!productId) {
    return { ok: false, message: 'Paid plans require a Stripe Product ID.' }
  }
  if (!priceId) {
    return { ok: false, message: 'Paid plans require a Stripe Price ID.' }
  }

  const product = await validateStripeProductId(productId)
  if (!product.ok) return { ok: false, message: product.error }

  const price = await validateStripePriceId(priceId, productId)
  if (!price.ok) return { ok: false, message: price.error }

  return { ok: true }
}

export type CompanyPlanInput = {
  name: string
  description?: string | null
  price?: number
  currency?: string
  billingInterval?: string
  stripeProductId?: string | null
  stripePriceId?: string | null
  features?: string[]
  isActive?: boolean
  displayOrder?: number
}

const ALLOWED_BILLING_INTERVALS = ['day', 'week', 'month', 'year']

export function normalizeCompanyPlanInput(body: Record<string, unknown>): CompanyPlanInput | null {
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return null

  const price = Number.isFinite(Number(body.price)) ? Math.max(0, Math.round(Number(body.price))) : 0
  const billingInterval = typeof body.billingInterval === 'string' && ALLOWED_BILLING_INTERVALS.includes(body.billingInterval)
    ? body.billingInterval
    : 'month'
  const currency = typeof body.currency === 'string' && body.currency.trim() ? body.currency.trim().toLowerCase() : 'usd'

  return {
    name,
    description: body.description === undefined || body.description === null ? null : String(body.description),
    price,
    currency,
    billingInterval,
    stripeProductId: body.stripeProductId === undefined ? undefined : (typeof body.stripeProductId === 'string' ? body.stripeProductId.trim() || null : null),
    stripePriceId: body.stripePriceId === undefined ? undefined : (typeof body.stripePriceId === 'string' ? body.stripePriceId.trim() || null : null),
    features: Array.isArray(body.features) ? body.features.filter((feature): feature is string => typeof feature === 'string') : undefined,
    isActive: body.isActive === undefined ? undefined : Boolean(body.isActive),
    displayOrder: Number.isFinite(Number(body.displayOrder)) ? Math.round(Number(body.displayOrder)) : undefined,
  }
}

// Resolves the exact Stripe price for checkout from a plan ID. The server is
// authoritative: a client-supplied price is never trusted.
export async function resolveCompanyCheckoutPrice(planId: string) {
  const plan = await prisma.companyAdvertisingPlan.findUnique({
    where: { id: planId, isActive: true },
  })
  if (!plan) return { ok: false as const, reason: 'Company advertising plan is not available.' }
  if (plan.price <= 0) {
    // FREE / zero-price plan: no Stripe checkout required.
    return { ok: true as const, plan, priceId: null }
  }
  if (!plan.stripePriceId) {
    return { ok: false as const, reason: 'Company advertising plan is not configured for checkout.' }
  }
  return { ok: true as const, plan, priceId: plan.stripePriceId }
}