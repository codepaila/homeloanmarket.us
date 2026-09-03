import prisma from '@/lib/prisma'
import Stripe from 'stripe'
import type { BrokerSubscriptionPlan, BrokerSubscriptionPlanFeature } from '@prisma/client'
import { getStripeSecretKey } from '@/lib/stripe-config'

// Customer-facing display names for plan codes. Internal codes (FREE,
// FEATURED) are preserved for compatibility; only the presented name changes.
export const BROKER_PLAN_DISPLAY_NAME: Record<string, string> = {
  FREE: 'Free',
  FEATURED: 'Mortgage Expert',
}

// The ONLY supported fixed broker subscription plans. Internal codes are
// immutable and derived from the canonical mapping. Admins manage these plans;
// arbitrary plan codes/names are rejected at the API boundary.
export const SUPPORTED_BROKER_PLAN_CODES = ['FREE', 'FEATURED'] as const
export type SupportedBrokerPlanCode = (typeof SUPPORTED_BROKER_PLAN_CODES)[number]

export function isSupportedBrokerPlanCode(value: string): value is SupportedBrokerPlanCode {
  return (SUPPORTED_BROKER_PLAN_CODES as readonly string[]).includes(value)
}

// Canonical customer-facing name for a fixed broker plan code. Returns null
// for unknown codes so callers can reject arbitrary plans.
export function getBrokerPlanDisplayName(code: string): string | null {
  return BROKER_PLAN_DISPLAY_NAME[code] ?? null
}

export type PlanWithFeatures = BrokerSubscriptionPlan & {
  features: BrokerSubscriptionPlanFeature[]
}

export type BrokerPlanFeatureDraft = {
  label: string
  enabled: boolean
  sortOrder: number
}

// Default customer-facing features used to seed a brand-new plan. These are
// simple display rows (label/enabled/sortOrder only). They exist solely for
// initial population and are NEVER used as runtime display overrides — the
// database BrokerSubscriptionPlanFeature rows are the source of truth.
export const DEFAULT_BROKER_PLAN_FEATURES: Record<string, BrokerPlanFeatureDraft[]> = {
  FREE: [
    { label: 'Local Broker Listing', enabled: true, sortOrder: 10 },
    { label: 'Appear in Search Results', enabled: true, sortOrder: 20 },
    { label: 'Profile & Contact Information', enabled: true, sortOrder: 30 },
    { label: 'Visibility Across Your Metro Area', enabled: true, sortOrder: 40 },
    { label: 'Greater Exposure to a Large, Hard-to-Reach Homebuyer Community', enabled: true, sortOrder: 50 },
    { label: 'Free', enabled: true, sortOrder: 60 },
  ],
  FEATURED: [
    { label: 'Local Broker Listing', enabled: true, sortOrder: 10 },
    { label: 'Appear Above Free Listings', enabled: true, sortOrder: 20 },
    { label: 'Profile & Contact Information', enabled: true, sortOrder: 30 },
    { label: 'Visibility Across Your Metro Area', enabled: true, sortOrder: 40 },
    { label: 'Greater Exposure to a Large, Hard-to-Reach Homebuyer Community', enabled: true, sortOrder: 50 },
    { label: 'Mortgage Expert Badge + 5 Green Stars', enabled: true, sortOrder: 60 },
    { label: 'Cancel Anytime', enabled: true, sortOrder: 70 },
  ],
  PREMIUM: [],
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
  features: BrokerPlanFeatureDraft[]
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
    features: DEFAULT_BROKER_PLAN_FEATURES.FREE,
  },
  {
    code: 'FEATURED',
    name: 'Mortgage Expert',
    description: 'Get featured in listings and direct leads',
    price: 1500,
    billingInterval: 'month',
    currency: 'usd',
    displayOrder: 20,
    isActive: true,
    features: DEFAULT_BROKER_PLAN_FEATURES.FEATURED,
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
    features: DEFAULT_BROKER_PLAN_FEATURES.PREMIUM,
  },
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
  // Customer-facing labels of enabled features, ordered for display.
  features: string[]
}

// Public, display-safe shape of the dynamic plans. The DB is the single source
// of truth for name, price, currency, billing interval, ordering, and features.
// Feature rows are simple display content (label/enabled/sortOrder) with no
// business meaning.
export function toBrokerPlanPublic(plan: PlanWithFeatures): BrokerPlanPublic {
  return {
    id: plan.id,
    code: plan.code,
    name: BROKER_PLAN_DISPLAY_NAME[plan.code] || plan.name,
    description: plan.description,
    price: plan.price,
    currency: plan.currency,
    billingInterval: plan.billingInterval,
    displayOrder: plan.displayOrder,
    stripePriceId: plan.stripePriceId,
    isActive: plan.isActive,
    features: plan.features
      .filter((feature) => feature.enabled)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((feature) => feature.label),
  }
}

export async function listBrokerPlansPublic() {
  const plans = await listBrokerPlans()
  return plans.map(toBrokerPlanPublic)
}

// ---------------------------------------------------------------------------
// Mortgage Expert badge entitlement
// ---------------------------------------------------------------------------
// The Mortgage Expert badge is a business property of the broker's plan, not a
// display feature. A broker qualifies when their active subscription is on a
// paid (non-FREE) plan. This is decoupled from the display feature rows, which
// have no entitlement meaning.

type BrokerSubscriptionState = {
  isActive?: boolean
  endDate?: Date | null
  plan?: string | null
}

function subscriptionIsEntitled(subscription: BrokerSubscriptionState | null | undefined) {
  if (!subscription) return false
  if (subscription.isActive !== true) return false
  if (subscription.endDate && subscription.endDate <= new Date()) return false
  return true
}

// Whether an active subscription is on a paid (non-FREE) broker plan. Used to
// derive the Mortgage Expert badge entitlement. Decoupled from display feature
// rows, which carry no business meaning.
export function brokerSubscriptionHasProfileBadge(
  subscription: BrokerSubscriptionState | null | undefined,
) {
  if (!subscriptionIsEntitled(subscription)) return false
  return Boolean(subscription?.plan && subscription.plan !== 'FREE')
}

// ---------------------------------------------------------------------------
// Plan write helpers (admin-authorized)
// ---------------------------------------------------------------------------

// A feature row as submitted by the admin form. An existing row carries its
// DB `id`; a new row omits it. Display-only.
export type BrokerPlanFeatureDraftInput = {
  id?: string
  label: string
  enabled: boolean
  sortOrder: number
}

// Create feature rows for a brand-new plan (no rows exist yet).
export async function createPlanFeatures(
  tx: {
    brokerSubscriptionPlanFeature: { createMany: (args: { data: Array<{ planId: string; label: string; enabled: boolean; sortOrder: number }> }) => Promise<unknown> }
  },
  planId: string,
  features: BrokerPlanFeatureDraftInput[],
) {
  const rows = features.map((f) => ({
    planId,
    label: f.label,
    enabled: f.enabled,
    sortOrder: Number.isFinite(f.sortOrder) ? Math.round(f.sortOrder) : 0,
  }))
  if (rows.length > 0) {
    await tx.brokerSubscriptionPlanFeature.createMany({ data: rows })
  }
}

// Sync a plan's feature rows to match the submitted full list. Preserves
// existing row IDs: rows carrying an `id` are updated in place, rows without
// an `id` are created, and existing rows whose `id` is absent are deleted.
// Never touches the plan, Stripe, or subscriptions.
export async function syncPlanFeatures(
  tx: {
    brokerSubscriptionPlanFeature: {
      findMany: (args: { where: { planId: string }; select: { id: true } }) => Promise<Array<{ id: string }>>
      deleteMany: (args: { where: { planId: string; id: { in: string[] } } }) => Promise<unknown>
      createMany: (args: { data: Array<{ planId: string; label: string; enabled: boolean; sortOrder: number }> }) => Promise<unknown>
      update: (args: { where: { id: string }; data: { label: string; enabled: boolean; sortOrder: number } }) => Promise<unknown>
    }
  },
  planId: string,
  features: BrokerPlanFeatureDraftInput[],
) {
  const toCreate = features.filter((f) => !f.id)
  const toUpdate = features.filter((f) => f.id)
  const submittedIds = new Set(toUpdate.map((f) => f.id as string))

  const existing = await tx.brokerSubscriptionPlanFeature.findMany({ where: { planId }, select: { id: true } })
  const toDelete = existing.filter((row) => !submittedIds.has(row.id)).map((row) => row.id)

  if (toDelete.length > 0) {
    await tx.brokerSubscriptionPlanFeature.deleteMany({ where: { planId, id: { in: toDelete } } })
  }
  if (toCreate.length > 0) {
    await tx.brokerSubscriptionPlanFeature.createMany({
      data: toCreate.map((f) => ({ planId, label: f.label, enabled: f.enabled, sortOrder: Number.isFinite(f.sortOrder) ? Math.round(f.sortOrder) : 0 })),
    })
  }
  for (const f of toUpdate) {
    await tx.brokerSubscriptionPlanFeature.update({
      where: { id: f.id as string },
      data: { label: f.label, enabled: f.enabled, sortOrder: Number.isFinite(f.sortOrder) ? Math.round(f.sortOrder) : 0 },
    })
  }
}

export function normalizePlanCode(value: unknown) {
  if (typeof value !== 'string') return null
  const code = value.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_').replace(/^_+|_+$/g, '')
  return code || null
}

// Sanitize the feature rows submitted by the admin form. Returns null when the
// payload is not a valid array of display feature rows, or an array of drafts.
// Each draft carries an optional existing DB `id`, a non-empty trimmed `label`,
// an `enabled` flag, and a `sortOrder`.
export function sanitizeFeatureDrafts(value: unknown): BrokerPlanFeatureDraftInput[] | null {
  if (!Array.isArray(value)) return null
  const out: BrokerPlanFeatureDraftInput[] = []
  for (const item of value) {
    if (typeof item !== 'object' || item === null) return null
    const row = item as Record<string, unknown>
    const label = typeof row.label === 'string' ? row.label.trim() : ''
    if (!label) return null
    if (label.length > 120) return null
    const enabled = row.enabled === true
    const sortOrder = typeof row.sortOrder === 'number' && Number.isFinite(row.sortOrder) ? Math.round(row.sortOrder) : 0
    const id = typeof row.id === 'string' && row.id ? row.id : undefined
    out.push({ id, label, enabled, sortOrder })
  }
  return out
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
