// Cross-product Stripe Price isolation.
//
// Broker subscription plans (BrokerSubscriptionPlan) and Company advertising
// plans (CompanyAdvertisingPlan) are separate billing products and must never
// reuse the same Stripe Price. `CompanyAdvertisingPlan.stripePriceId` is
// already @unique within its own model, but `BrokerSubscriptionPlan.stripePriceId`
// is not — so the same Price could be assigned to both a broker plan and a
// company plan without database-level protection.
//
// This module provides server-side application-level enforcement at every admin
// write path. It intentionally does not add a database-level global uniqueness
// constraint (which, on this MongoDB/Prisma schema, could fail on existing
// duplicates and is not strictly necessary given the schema's referential
// flexibility); app-level validation gives sufficient protection and a clear
// error message without leaking internal data.
import prisma from '@/lib/prisma'

export const CROSS_PRODUCT_PRICE_ERROR = 'This Stripe Price is already assigned to another subscription product.'

export type PriceIsolationResult =
  | { ok: true }
  | { ok: false; message: string }

// Verifies that a Stripe Price being assigned to a plan of `sourceProduct` is
// not already assigned to a plan of the OTHER product. `excludePlanId` lets an
// update skip the plan being edited (which may legitimately keep its own price).
export async function assertStripePriceIsolation(
  stripePriceId: string | null | undefined,
  sourceProduct: 'COMPANY' | 'BROKER',
  excludePlanId?: string | null,
): Promise<PriceIsolationResult> {
  const priceId = stripePriceId?.trim() || null
  if (!priceId) return { ok: true }

  if (sourceProduct === 'COMPANY') {
    // The Price is being (re)assigned to a Company plan: it must not already
    // belong to a Broker plan.
    const conflict = await prisma.brokerSubscriptionPlan.findFirst({
      where: { stripePriceId: priceId, ...(excludePlanId ? { id: { not: excludePlanId } } : {}) },
      select: { id: true },
    })
    if (conflict) return { ok: false, message: CROSS_PRODUCT_PRICE_ERROR }
    return { ok: true }
  }

  // The Price is being (re)assigned to a Broker plan: it must not already
  // belong to a Company advertising plan.
  const conflict = await prisma.companyAdvertisingPlan.findFirst({
    where: { stripePriceId: priceId, ...(excludePlanId ? { id: { not: excludePlanId } } : {}) },
    select: { id: true },
  })
  if (conflict) return { ok: false, message: CROSS_PRODUCT_PRICE_ERROR }
  return { ok: true }
}
