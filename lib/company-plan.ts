import prisma from '@/lib/prisma'

export const COMPANY_PLAN_DEFAULT_NAME = 'ADVERTISING'

export async function getActiveCompanyAdvertisingPlans() {
  return prisma.companyAdvertisingPlan.findMany({
    where: { isActive: true },
    orderBy: [{ price: 'asc' }, { name: 'asc' }],
  })
}

export async function getCompanyAdvertisingPlan(planId: string) {
  return prisma.companyAdvertisingPlan.findFirst({ where: { id: planId, isActive: true } })
}

export async function resolveCompanyPlanForCheckout(planId?: string | null) {
  if (planId) {
    const plan = await getCompanyAdvertisingPlan(planId)
    if (plan) return plan
  }
  const plans = await getActiveCompanyAdvertisingPlans()
  if (plans.length > 0) return plans[0]
  return null
}

export async function resolveCompanyPlanByStripePrice(priceId: string | null | undefined) {
  if (!priceId) return null
  return prisma.companyAdvertisingPlan.findFirst({ where: { stripePriceId: priceId } })
}
