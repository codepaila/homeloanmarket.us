import 'dotenv/config'
import prisma from '@/lib/prisma'
import { DEFAULT_COMPANY_PLANS } from '@/lib/company-plan-definitions'

// Canonical company advertising plan reconcile. Ensures the single customer-
// facing active company plan ('ADVERTISING') exists and carries the configured
// Stripe product/price IDs. Never deletes historical plans or subscriptions and
// never deactivates rows that already exist — it only reconciles the canonical
// plan's Stripe configuration from environment variables.
async function main() {
  const canonical = DEFAULT_COMPANY_PLANS[0]
  if (!canonical) throw new Error('No canonical company advertising plan is defined')

  const existing = await prisma.companyAdvertisingPlan.findUnique({ where: { name: canonical.name } })
  const priceId = canonical.stripePriceId || null
  const productId = canonical.stripeProductId || null

  if (existing) {
    if ((priceId && existing.stripePriceId !== priceId) || (productId && existing.stripeProductId !== productId)) {
      const updated = await prisma.companyAdvertisingPlan.update({
        where: { id: existing.id },
        data: {
          ...(priceId ? { stripePriceId: priceId } : {}),
          ...(productId ? { stripeProductId: productId } : {}),
        },
      })
      console.info('[COMPANY PLAN] updated', { planId: updated.id, name: updated.name, status: 'healthy' })
      return
    }
    console.info('[COMPANY PLAN] healthy', { planId: existing.id, name: existing.name, status: 'healthy' })
    return
  }

  const plan = await prisma.companyAdvertisingPlan.create({
    data: {
      name: canonical.name,
      description: canonical.description,
      price: canonical.price,
      billingInterval: canonical.billingInterval,
      currency: canonical.currency,
      displayOrder: canonical.displayOrder,
      stripeProductId: productId,
      stripePriceId: priceId,
      features: canonical.features,
      isActive: true,
    },
  })
  console.info('[COMPANY PLAN] created', { planId: plan.id, name: plan.name, status: 'reconciled' })
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})