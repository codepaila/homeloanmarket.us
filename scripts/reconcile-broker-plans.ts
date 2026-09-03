/* eslint-disable @typescript-eslint/no-explicit-any */
// Idempotent reconciliation for the database-backed broker subscription plans.
//
// SAFE: creates/updates only the BrokerSubscriptionPlan and
// BrokerSubscriptionPlanFeature collections and links existing
// BrokerSubscription.planId rows. It never deletes plans, never cancels
// subscriptions, and never modifies subscription billing data.
//
// The subscription→plan linking logic is shared with the admin Broker
// Subscriptions UI (lib/broker-plans.ts) so both produce identical behavior.
//
// Run: npm run db:reconcile-broker-plans
import prisma from '@/lib/prisma'
import {
  DEFAULT_BROKER_PLANS,
  DEFAULT_BROKER_PLAN_FEATURES,
  createPlanFeatures,
  reconcileBrokerSubscriptions,
} from '@/lib/broker-plans'

const FEATURED_STRIPE_PRICE_ID = process.env.STRIPE_STANDARD_PRICE_ID || null

async function run() {
  const summary = { plans: 0, features: 0 }

  for (const planInput of DEFAULT_BROKER_PLANS) {
    const existing = await prisma.brokerSubscriptionPlan.findUnique({ where: { code: planInput.code } })
    const stripePriceId = planInput.code === 'FEATURED' ? FEATURED_STRIPE_PRICE_ID : null

    if (!existing) {
      const created = await prisma.$transaction(async (tx) => {
        const plan = await tx.brokerSubscriptionPlan.create({
          data: {
            code: planInput.code,
            name: planInput.name,
            description: planInput.description,
            price: planInput.price,
            billingInterval: planInput.billingInterval,
            currency: planInput.currency,
            stripeProductId: null,
            stripePriceId,
            isActive: planInput.isActive,
            displayOrder: planInput.displayOrder,
          },
        })
        await createPlanFeatures(tx as any, plan.id, planInput.features)
        return plan
      })
      summary.plans += 1
      summary.features += planInput.features.length
      console.info('[BROKER-PLANS] created plan', { code: planInput.code, id: created.id })
    } else {
      const updates: Record<string, unknown> = {
        name: planInput.name,
        description: planInput.description,
        price: planInput.price,
        billingInterval: planInput.billingInterval,
        currency: planInput.currency,
        isActive: planInput.isActive,
        displayOrder: planInput.displayOrder,
      }
      if (stripePriceId) updates.stripePriceId = stripePriceId
      await prisma.$transaction(async (tx) => {
        await tx.brokerSubscriptionPlan.update({ where: { code: planInput.code }, data: updates })
        // Do NOT sync features here: that would delete admin-created custom
        // features and clobber admin edits to labels/ordering. Reconciliation
        // only fills in missing default features (handled below).
      })
      console.info('[BROKER-PLANS] reconciled existing plan', { code: planInput.code, id: existing.id })
    }
  }

  // Link existing subscriptions to the plan records by their stored plan code.
  // Reuses the shared service so the CLI and admin UI behave identically.
  const reconcile = await reconcileBrokerSubscriptions()
  console.info('[BROKER-PLANS] subscription→plan reconciliation', reconcile)

  // Backfill missing feature rows (e.g. a plan created without features). Only
  // INSERT missing display features matched by label — never overwrite existing
  // rows, so admin edits to enabled/label/sortOrder and admin-removed features
  // are preserved.
  const featurePlans = await prisma.brokerSubscriptionPlan.findMany({
    include: { features: { select: { label: true } } },
  })
  for (const plan of featurePlans) {
    const fallback = DEFAULT_BROKER_PLAN_FEATURES[plan.code]
    if (!fallback) continue
    const existingLabels = new Set(plan.features.map((f) => f.label))
    const missing = fallback.filter((draft) => !existingLabels.has(draft.label))
    if (missing.length > 0) {
      await prisma.brokerSubscriptionPlanFeature.createMany({
        data: missing.map((draft) => ({
          planId: plan.id,
          label: draft.label,
          enabled: draft.enabled,
          sortOrder: draft.sortOrder,
        })),
      })
      summary.features += missing.length
    }
  }

  console.info('[BROKER-PLANS] reconciliation complete', { ...summary, subscriptionLink: reconcile })
}

run()
  .catch((error) => {
    console.error('[BROKER-PLANS] reconciliation failed', error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())