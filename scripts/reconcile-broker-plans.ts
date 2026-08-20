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
  upsertPlanFeatures,
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
        await upsertPlanFeatures(tx as any, plan.id, planInput.features)
        return plan
      })
      summary.plans += 1
      summary.features += Object.keys(planInput.features).length
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
        await upsertPlanFeatures(tx as any, existing.id, planInput.features)
      })
      summary.features += Object.keys(planInput.features).length
      console.info('[BROKER-PLANS] reconciled existing plan', { code: planInput.code, id: existing.id })
    }
  }

  // Link existing subscriptions to the plan records by their stored plan code.
  // Reuses the shared service so the CLI and admin UI behave identically.
  const reconcile = await reconcileBrokerSubscriptions()
  console.info('[BROKER-PLANS] subscription→plan reconciliation', reconcile)

  // Backfill missing feature rows (e.g. a plan created without features).
  const featurePlans = await prisma.brokerSubscriptionPlan.findMany({
    include: { features: { select: { code: true } } },
  })
  for (const plan of featurePlans) {
    const fallback = DEFAULT_BROKER_PLAN_FEATURES[plan.code]
    if (!fallback) continue
    const missing = Object.keys(fallback).filter((code) => !plan.features.some((feature) => feature.code === code))
    if (missing.length > 0) {
      await prisma.brokerSubscriptionPlanFeature.createMany({
        data: missing.map((code) => ({ planId: plan.id, code, enabled: fallback[code as keyof typeof fallback] === true })),
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