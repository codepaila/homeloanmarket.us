import prisma from '@/lib/prisma'

export const COMPANY_PLAN_DEFAULT_NAME = 'ADVERTISING'

export async function getActiveCompanyAdvertisingPlans() {
  return prisma.companyAdvertisingPlan.findMany({
    where: { isActive: true },
    orderBy: [{ displayOrder: 'asc' }, { price: 'asc' }, { name: 'asc' }],
  })
}

export async function getCompanyAdvertisingPlan(planId: string) {
  return prisma.companyAdvertisingPlan.findFirst({ where: { id: planId, isActive: true } })
}

export async function resolveCompanyPlanForCheckout(planId?: string | null) {
  // A requested planId must resolve to an active plan; do not silently fall
  // back to another plan when the requested plan is inactive or missing.
  if (planId) {
    return getCompanyAdvertisingPlan(planId)
  }
  const plans = await getActiveCompanyAdvertisingPlans()
  return plans.length > 0 ? plans[0] : null
}

export async function resolveCompanyPlanByStripePrice(priceId: string | null | undefined) {
  if (!priceId) return null
  return prisma.companyAdvertisingPlan.findFirst({ where: { stripePriceId: priceId } })
}
