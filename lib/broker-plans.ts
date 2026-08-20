import prisma from '@/lib/prisma'
import Stripe from 'stripe'
import type { BrokerSubscriptionPlan, BrokerSubscriptionPlanFeature } from '@prisma/client'
import { getStripeSecretKey } from '@/lib/stripe-config'

// Feature codes supported by the platform. Keep this list explicit — new
// features are added here and then surfaced through the admin plan editor.
export const BROKER_PLAN_FEATURES = {
  PROFILE_BADGE: 'PROFILE_BADGE',
  SUPPORT_TICKETS: 'SUPPORT_TICKETS',
} as const

export type BrokerPlanFeatureCode = (typeof BROKER_PLAN_FEATURES)[keyof typeof BROKER_PLAN_FEATURES]

export type BrokerPlanFeatureInput = Partial<Record<BrokerPlanFeatureCode, boolean>>

export type PlanWithFeatures = BrokerSubscriptionPlan & {
  features: BrokerSubscriptionPlanFeature[]
}

type PlanFeatureRow = Pick<BrokerSubscriptionPlanFeature, 'code' | 'enabled'> | null

// Fallback feature map used ONLY until the database-backed plans are seeded
// (e.g. before the reconcile script runs in a fresh environment). It is never
// the source of truth; the admin-managed BrokerSubscriptionPlan records are.
export const DEFAULT_BROKER_PLAN_FEATURES: Record<string, BrokerPlanFeatureInput> = {
  FREE: { PROFILE_BADGE: false, SUPPORT_TICKETS: false },
  FEATURED: { PROFILE_BADGE: true, SUPPORT_TICKETS: true },
  PREMIUM: { PROFILE_BADGE: true, SUPPORT_TICKETS: true },
}

// Initial plan records created by the idempotent reconcile script. Prices are
// in cents. Stripe identifiers for FREE are intentionally null; FEATURED picks
// up the existing environment price; PREMIUM requires an admin to connect.
export const DEFAULT_BROKER_PLANS: Array<{
  code: string
  name: string
  description: string
  price: number
  billingInterval: string
  currency: string
  displayOrder: number
  isActive: boolean
  features: BrokerPlanFeatureInput
}> = [
  {
    code: 'FREE',
    name: 'Free',
    description: 'Basic broker listing',
    price: 0,
    billingInterval: 'month',
    currency: 'usd',
    displayOrder: 10,
    isActive: true,
    features: { PROFILE_BADGE: false, SUPPORT_TICKETS: false },
  },
  {
    code: 'FEATURED',
    name: 'Featured',
    description: 'Get featured in listings and direct leads',
    price: 1500,
    billingInterval: 'month',
    currency: 'usd',
    displayOrder: 20,
    isActive: true,
    features: { PROFILE_BADGE: true, SUPPORT_TICKETS: true },
  },
  {
    code: 'PREMIUM',
    name: 'Premium',
    description: 'Premium listing with full platform features',
    price: 3000,
    billingInterval: 'month',
    currency: 'usd',
    displayOrder: 30,
    isActive: true,
    features: { PROFILE_BADGE: true, SUPPORT_TICKETS: true },
  },
]

export const ALL_BROKER_PLAN_FEATURES: BrokerPlanFeatureCode[] = [
  BROKER_PLAN_FEATURES.PROFILE_BADGE,
  BROKER_PLAN_FEATURES.SUPPORT_TICKETS,
]

// ---------------------------------------------------------------------------
// Plan lookups
// ---------------------------------------------------------------------------

export async function getBrokerPlanByCode(code: string) {
  return prisma.brokerSubscriptionPlan.findUnique({
    where: { code },
    include: { features: true },
  })
}

export async function getBrokerPlanById(id: string) {
  return prisma.brokerSubscriptionPlan.findUnique({
    where: { id },
    include: { features: true },
  })
}

export async function listBrokerPlans(options?: { includeInactive?: boolean }) {
  return prisma.brokerSubscriptionPlan.findMany({
    where: options?.includeInactive ? undefined : { isActive: true },
    include: {
      features: true,
      _count: { select: { subscriptions: true } },
    },
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
  })
}

export async function getActiveSubscriberCount(planId: string) {
  return prisma.brokerSubscription.count({ where: { planId, isActive: true } })
}

// Human-readable feature labels for the enabled plan features shown to
// customers. This is the ONLY presentation mapping for plan features; it maps
// a feature code to a friendly label and is never used for entitlement checks.
const BROKER_FEATURE_LABELS: Record<string, string> = {
  PROFILE_BADGE: 'Profile Badge',
  SUPPORT_TICKETS: 'Priority Support Tickets',
}

export function brokerFeatureLabel(code: string) {
  return BROKER_FEATURE_LABELS[code] || code.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())
}

export type BrokerPlanPublic = {
  id: string
  code: string
  name: string
  description: string | null
  price: number
  currency: string
  billingInterval: string
  displayOrder: number
  stripePriceId: string | null
  isActive: boolean
  // Human-readable enabled feature labels for display.
  features: string[]
  // Feature-code → enabled map for UI that needs it.
  featureMap: Record<string, boolean>
}

// Public, display-safe shape of the dynamic plans. The DB is the single source
// of truth for name, price, currency, billing interval, ordering, and features.
export function toBrokerPlanPublic(plan: PlanWithFeatures): BrokerPlanPublic {
  return {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    description: plan.description,
    price: plan.price,
    currency: plan.currency,
    billingInterval: plan.billingInterval,
    displayOrder: plan.displayOrder,
    stripePriceId: plan.stripePriceId,
    isActive: plan.isActive,
    features: plan.features.filter((feature) => feature.enabled).map((feature) => brokerFeatureLabel(feature.code)),
    featureMap: Object.fromEntries(plan.features.map((feature) => [feature.code, feature.enabled])),
  }
}

export async function listBrokerPlansPublic() {
  const plans = await listBrokerPlans()
  return plans.map(toBrokerPlanPublic)
}

// ---------------------------------------------------------------------------
// Feature entitlement
// ---------------------------------------------------------------------------

export function planHasFeature(plan: { features: PlanFeatureRow[] } | null, featureCode: BrokerPlanFeatureCode) {
  return Boolean(plan?.features?.some((feature) => feature?.code === featureCode && feature.enabled === true))
}

type BrokerSubscriptionFeatureState = {
  isActive?: boolean
  endDate?: Date | null
  plan?: string | null
  planRef?: ({ features: PlanFeatureRow[] } & Record<string, unknown>) | null
}

// Fallback used when the database plan records are not yet seeded. Keeps
// existing behavior intact during the migration window and for plans whose
// DB configuration is absent.
function fallbackPlanHasFeature(planCode: string | null | undefined, featureCode: BrokerPlanFeatureCode) {
  if (!planCode) return false
  return DEFAULT_BROKER_PLAN_FEATURES[planCode]?.[featureCode] === true
}

function subscriptionIsEntitled(subscription: BrokerSubscriptionFeatureState | null | undefined) {
  if (!subscription) return false
  if (subscription.isActive !== true) return false
  if (subscription.endDate && subscription.endDate <= new Date()) return false
  return true
}

// Sync helper for subscription rows that already include `planRef` with its
// features (avoids an N+1 query in listing/detail routes).
export function brokerSubscriptionHasFeature(
  subscription: BrokerSubscriptionFeatureState | null | undefined,
  featureCode: BrokerPlanFeatureCode,
) {
  if (!subscription || !subscriptionIsEntitled(subscription)) return false
  const planRef = subscription.planRef
  if (planRef) {
    return planHasFeature(planRef as PlanWithFeatures, featureCode)
  }
  return fallbackPlanHasFeature(subscription.plan, featureCode)
}

// Authoritative server-side entitlement check.
export async function hasBrokerFeature(brokerId: string, featureCode: BrokerPlanFeatureCode) {
  const subscription = await prisma.brokerSubscription.findUnique({
    where: { brokerId },
    include: { planRef: { include: { features: true } } },
  })
  return brokerSubscriptionHasFeature(subscription, featureCode)
}

// Resolves PROFILE_BADGE entitlement for a subscription that may or may not
// already carry its plan relation. Loads the plan from the database only when
// it was not included (used by admin/API surfaces that select scalars only).
export async function resolveBrokerProfileBadge(subscription: BrokerSubscriptionFeatureState | null | undefined) {
  if (!subscription || !subscriptionIsEntitled(subscription)) return false
  const planRef = subscription.planRef
  if (planRef) {
    return planHasFeature(planRef as PlanWithFeatures, BROKER_PLAN_FEATURES.PROFILE_BADGE)
  }
  const planId = (subscription as { planId?: string | null }).planId
  if (planId) {
    const plan = await getBrokerPlanById(planId)
    if (plan) return planHasFeature(plan, BROKER_PLAN_FEATURES.PROFILE_BADGE)
  }
  return fallbackPlanHasFeature(subscription.plan, BROKER_PLAN_FEATURES.PROFILE_BADGE)
}

// ---------------------------------------------------------------------------
// Plan write helpers (admin-authorized)
// ---------------------------------------------------------------------------

export async function upsertPlanFeatures(
  tx: { brokerSubscriptionPlanFeature: { deleteMany: (args: unknown) => Promise<unknown>; createMany: (args: unknown) => Promise<unknown> } },
  planId: string,
  features: BrokerPlanFeatureInput,
) {
  await tx.brokerSubscriptionPlanFeature.deleteMany({ where: { planId } })
  const rows = ALL_BROKER_PLAN_FEATURES.filter((code) => code in features).map((code) => ({
    planId,
    code,
    enabled: features[code] === true,
  }))
  if (rows.length > 0) {
    await tx.brokerSubscriptionPlanFeature.createMany({ data: rows })
  }
}

export function normalizePlanCode(value: unknown) {
  if (typeof value !== 'string') return null
  const code = value.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_').replace(/^_+|_+$/g, '')
  return code || null
}

// ---------------------------------------------------------------------------
// Broker subscription migration / reconciliation
// ---------------------------------------------------------------------------
// The CLI reconcile script and the admin subscription-management UI must
// behave identically. All matching/linking logic is centralized here so there
// is only one implementation.

// Resolve the dynamic plan that matches a stable plan code. Returns null when
// no unique active match exists (missing, inactive-only, or ambiguous).
export async function resolveBrokerPlanByCode(code: string) {
  const plans = await prisma.brokerSubscriptionPlan.findMany({
    where: { code },
    include: { features: true },
  })
  if (plans.length !== 1) return null
  const plan = plans[0]
  return plan.isActive ? plan : null
}

export type BrokerMigrationResult =
  | { status: 'linked'; planId: string; planCode: string }
  | { status: 'already-linked'; planId: string }
  | { status: 'unknown-plan' }
  | { status: 'ambiguous' }

export async function linkBrokerSubscriptionToPlan(subscriptionId: string): Promise<BrokerMigrationResult> {
  const subscription = await prisma.brokerSubscription.findUnique({
    where: { id: subscriptionId },
    select: { id: true, plan: true, planId: true },
  })
  if (!subscription) return { status: 'unknown-plan' }

  // Only migrate when planId is missing.
  if (subscription.planId) return { status: 'already-linked', planId: subscription.planId }

  const plan = await resolveBrokerPlanByCode(subscription.plan)
  if (!plan) return { status: 'unknown-plan' }

  await prisma.brokerSubscription.update({
    where: { id: subscription.id },
    data: { planId: plan.id },
  })
  return { status: 'linked', planId: plan.id, planCode: plan.code }
}

export type BrokerReconciliationReport = {
  processed: number
  linked: number
  alreadyLinked: number
  unknownPlan: number
  ambiguous: number
  skipped: number
}

// Idempotent, non-destructive reconciliation of broker subscriptions against
// the dynamic plan records. Only populates planId; never touches billing data.
export async function reconcileBrokerSubscriptions(): Promise<BrokerReconciliationReport> {
  const report: BrokerReconciliationReport = { processed: 0, linked: 0, alreadyLinked: 0, unknownPlan: 0, ambiguous: 0, skipped: 0 }

  const subscriptions = await prisma.brokerSubscription.findMany({
    select: { id: true, plan: true, planId: true },
  })

  for (const subscription of subscriptions) {
    if (subscription.planId) {
      report.alreadyLinked += 1
      continue
    }
    report.processed += 1
    const plan = await resolveBrokerPlanByCode(subscription.plan)
    if (!plan) {
      report.unknownPlan += 1
      continue
    }
    await prisma.brokerSubscription.update({
      where: { id: subscription.id },
      data: { planId: plan.id },
    })
    report.linked += 1
  }

  return report
}

// ---------------------------------------------------------------------------
// Admin-created / imported broker FREE subscription handling
// ---------------------------------------------------------------------------

export const BROKER_FREE_PLAN_CODE = 'FREE'

// Resolves the active dynamic FREE plan, or throws a clear configuration error
// so admin-created/imported brokers never get a broken subscription state.
export async function requireActiveFreeBrokerPlan() {
  const plan = await resolveBrokerPlanByCode(BROKER_FREE_PLAN_CODE)
  if (!plan) {
    throw new Error('Active FREE broker subscription plan is required before importing/creating brokers.')
  }
  return plan
}

export type BrokerSubscriptionLinkResult =
  | { status: 'created' }
  | { status: 'linked' }
  | { status: 'unchanged' }
  | { status: 'preserved-other-plan' }

// Resolves the subscription a freshly admin-created/imported broker should
// have. Rules:
//  - No existing subscription → create FREE (plan + planId) — no Stripe.
//  - Existing FREE with missing planId → link to dynamic FREE plan.
//  - Existing correctly-linked subscription → leave unchanged.
//  - Existing OTHER plan (paid) → never downgrade/overwrite.
// Returns the final subscription plan state for the caller.
export async function ensureAdminCreatedBrokerFreeSubscription(
  tx: {
    brokerSubscription: {
      findUnique: (args: { where: { brokerId: string } }) => Promise<{ id: string; plan: string; planId: string | null } | null>
      upsert: (args: unknown) => Promise<unknown>
      update: (args: unknown) => Promise<unknown>
    }
    brokerSubscriptionPlan: {
      findUnique: (args: { where: { code: string } }) => Promise<{ id: string; code: string } | null>
    }
  },
  brokerId: string,
): Promise<BrokerSubscriptionLinkResult> {
  const freePlan = await tx.brokerSubscriptionPlan.findUnique({ where: { code: BROKER_FREE_PLAN_CODE } })
  if (!freePlan) throw new Error('Active FREE broker subscription plan is required before importing/creating brokers.')

  const existing = await tx.brokerSubscription.findUnique({ where: { brokerId } })

  if (existing && existing.planId) {
    // Already linked — never change it (could be FREE or a paid plan).
    return { status: 'unchanged' }
  }

  if (existing && existing.plan !== BROKER_FREE_PLAN_CODE) {
    // Existing non-FREE (paid) plan without planId: never downgrade. Leave as-is.
    return { status: 'preserved-other-plan' }
  }

  if (existing && existing.plan === BROKER_FREE_PLAN_CODE) {
    // FREE but unlinked — safely link to the dynamic FREE plan.
    await tx.brokerSubscription.update({
      where: { brokerId },
      data: { planId: freePlan.id },
    })
    return { status: 'linked' }
  }

  // No subscription exists — create FREE, no Stripe.
  await tx.brokerSubscription.upsert({
    where: { brokerId },
    update: { plan: BROKER_FREE_PLAN_CODE, planId: freePlan.id, isActive: true },
    create: { brokerId, plan: BROKER_FREE_PLAN_CODE, planId: freePlan.id, isActive: true, startDate: new Date(), endDate: null },
  })
  return { status: 'created' }
}

// ---------------------------------------------------------------------------
// Audit / backfill for admin-created brokers without subscriptions
// ---------------------------------------------------------------------------

export type AdminBrokerSubscriptionAudit = {
  adminCreatedBrokers: number
  alreadySubscribed: number
  missingSubscription: number
  legacyFreeUnlinked: number
  unknownCreationSource: number
  freeCreated: number
  preservedOtherPlan: number
  skipped: number
}

// Inspects admin-created/imported brokers and their subscription state without
// modifying anything.
export async function auditAdminCreatedBrokerSubscriptions(): Promise<AdminBrokerSubscriptionAudit> {
  const adminBrokers = await prisma.broker.findMany({
    where: { creationSource: 'ADMIN_CREATED' },
    select: { id: true, subscription: { select: { id: true, plan: true, planId: true } } },
  })
  const unknownSource = await prisma.broker.count({ where: { creationSource: null } })

  const audit: AdminBrokerSubscriptionAudit = {
    adminCreatedBrokers: adminBrokers.length,
    alreadySubscribed: 0,
    missingSubscription: 0,
    legacyFreeUnlinked: 0,
    unknownCreationSource: unknownSource,
    freeCreated: 0,
    preservedOtherPlan: 0,
    skipped: 0,
  }

  for (const broker of adminBrokers) {
    if (!broker.subscription) {
      audit.missingSubscription += 1
      continue
    }
    if (broker.subscription.planId) {
      audit.alreadySubscribed += 1
      continue
    }
    if (broker.subscription.plan === BROKER_FREE_PLAN_CODE) {
      audit.legacyFreeUnlinked += 1
      continue
    }
    // Other (paid) plan without planId — preserved, not downgraded.
    audit.preservedOtherPlan += 1
    audit.skipped += 1
  }

  return audit
}

export type AdminBrokerFreeBackfillReport = {
  adminCreatedBrokers: number
  alreadySubscribed: number
  missingSubscription: number
  freeCreated: number
  linked: number
  preservedOtherPlan: number
  skipped: number
}

// Explicit admin operation: create missing FREE subscriptions for
// admin-created brokers only. Idempotent, never downgrades, never touches
// Stripe, never touches brokers with unknown creation source.
export async function backfillAdminCreatedBrokerFreeSubscriptions(): Promise<AdminBrokerFreeBackfillReport> {
  const freePlan = await prisma.brokerSubscriptionPlan.findUnique({ where: { code: BROKER_FREE_PLAN_CODE } })
  if (!freePlan) throw new Error('Active FREE broker subscription plan is required before importing/creating brokers.')

  const adminBrokers = await prisma.broker.findMany({
    where: { creationSource: 'ADMIN_CREATED' },
    select: { id: true, subscription: { select: { id: true, plan: true, planId: true } } },
  })

  const report: AdminBrokerFreeBackfillReport = {
    adminCreatedBrokers: adminBrokers.length,
    alreadySubscribed: 0,
    missingSubscription: 0,
    freeCreated: 0,
    linked: 0,
    preservedOtherPlan: 0,
    skipped: 0,
  }

  for (const broker of adminBrokers) {
    if (broker.subscription && broker.subscription.planId) {
      report.alreadySubscribed += 1
      continue
    }
    if (broker.subscription && broker.subscription.plan !== BROKER_FREE_PLAN_CODE) {
      // Paid/unlinked plan — never downgrade.
      report.preservedOtherPlan += 1
      report.skipped += 1
      continue
    }
    if (broker.subscription && broker.subscription.plan === BROKER_FREE_PLAN_CODE) {
      await prisma.brokerSubscription.update({
        where: { brokerId: broker.id },
        data: { planId: freePlan.id },
      })
      report.linked += 1
      continue
    }
    if (!broker.subscription) {
      await prisma.brokerSubscription.create({
        data: { brokerId: broker.id, plan: BROKER_FREE_PLAN_CODE, planId: freePlan.id, isActive: true, startDate: new Date(), endDate: null },
      })
      report.freeCreated += 1
      report.missingSubscription += 1
    }
  }

  return report
}

// ---------------------------------------------------------------------------
// Stripe safety
// ---------------------------------------------------------------------------

async function stripeClient() {
  const key = await getStripeSecretKey()
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured')
  return new Stripe(key)
}

export type StripeValidationResult =
  | { ok: true; id: string; label: string }
  | { ok: false; error: string }

export async function validateStripeProductId(productId: string): Promise<StripeValidationResult> {
  try {
    const product = await (await stripeClient()).products.retrieve(productId)
    if (!product.active && product.active !== undefined) {
      return { ok: false, error: 'Stripe product is inactive' }
    }
    return { ok: true, id: product.id, label: product.name || product.id }
  } catch {
    return { ok: false, error: 'Stripe product could not be validated' }
  }
}

export async function validateStripePriceId(priceId: string, productId?: string): Promise<StripeValidationResult> {
  try {
    const price = await (await stripeClient()).prices.retrieve(priceId)
    if (productId && price.product !== productId) {
      return { ok: false, error: 'Stripe price does not belong to the given product' }
    }
    return { ok: true, id: price.id, label: `${(price.unit_amount ?? 0) / 100} ${price.currency}` }
  } catch {
    return { ok: false, error: 'Stripe price could not be validated' }
  }
}

// Server-side checkout guard: the requested plan must exist in the database,
// be active, be priced, and carry the exact Stripe price ID.
export async function validateBrokerPlanForCheckout(planCode: string, priceId: string) {
  const plan = await getBrokerPlanByCode(planCode)
  if (!plan) return { ok: false as const, reason: 'Invalid subscription plan' }
  if (!plan.isActive) return { ok: false as const, reason: 'This plan is not currently available' }
  if (!plan.stripePriceId || plan.stripePriceId !== priceId) {
    return { ok: false as const, reason: 'Invalid subscription plan or price' }
  }
  return { ok: true as const, plan }
}