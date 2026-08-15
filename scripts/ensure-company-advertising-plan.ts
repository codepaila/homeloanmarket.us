import 'dotenv/config'
import prisma from '@/lib/prisma'

const DEFAULT_NAME = 'ADVERTISING'

async function main() {
  const existing = await prisma.companyAdvertisingPlan.findFirst({ where: { name: DEFAULT_NAME } })
  if (existing) {
    const priceId = process.env.STRIPE_COMPANY_AD_PRICE_ID
    const productId = process.env.STRIPE_COMPANY_AD_PRODUCT_ID
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
      name: DEFAULT_NAME,
      description: 'Company advertising subscription with campaign and ad-request access.',
      price: 0,
      billingInterval: 'month',
      stripeProductId: process.env.STRIPE_COMPANY_AD_PRODUCT_ID || null,
      stripePriceId: process.env.STRIPE_COMPANY_AD_PRICE_ID || null,
      features: ['advertising request access', 'location and radius targeting', 'admin review'],
      isActive: true,
    },
  })
  console.info('[COMPANY PLAN] created', { planId: plan.id, name: plan.name, status: 'reconciled' })
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
