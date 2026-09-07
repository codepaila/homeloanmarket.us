import prisma from '@/lib/prisma'

export const COMPANY_PLAN_DEFAULT_NAME = 'ADVERTISING'

// MongoDB ObjectId validity guard. Arbitrary/non-ObjectId identifiers must fail
// closed (return null) instead of reaching Prisma and throwing a 500.
const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/

export function isValidCompanyPlanId(planId: string): boolean {
  return OBJECT_ID_RE.test(planId)
}

export async function getActiveCompanyAdvertisingPlans() {
  return prisma.companyAdvertisingPlan.findMany({
    where: { isActive: true },
    orderBy: [{ displayOrder: 'asc' }, { price: 'asc' }, { name: 'asc' }],
  })
}

// The single customer-facing company advertising plan. There must be exactly one
// active plan offered to customers. If the database holds more than one active
// plan (legacy tiers or an admin misconfiguration), the canonical plan is the
// one named COMPANY_PLAN_DEFAULT_NAME ('ADVERTISING') when present, else the
// lowest-ordered active plan. Historical/inactive rows are never deleted and
// never offered to customers.
export async function getCanonicalCompanyAdvertisingPlan() {
  const plans = await getActiveCompanyAdvertisingPlans()
  if (plans.length === 0) return null
  if (plans.length === 1) return plans[0]
  return plans.find((plan) => plan.name === COMPANY_PLAN_DEFAULT_NAME) ?? plans[0]
}

export async function getCompanyAdvertisingPlan(planId: string) {
  if (!isValidCompanyPlanId(planId)) return null
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
