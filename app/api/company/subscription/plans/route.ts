import { NextResponse } from 'next/server'
import { getCanonicalCompanyAdvertisingPlan } from '@/lib/company-plan'

export async function GET() {
  // Exactly one customer-facing company advertising plan. The canonical helper
  // guarantees a single active plan is exposed even if legacy/inactive rows or
  // admin misconfiguration left additional active rows in the database.
  const canonical = await getCanonicalCompanyAdvertisingPlan()
  return NextResponse.json({
    plans: canonical
      ? [
          {
            id: canonical.id,
            name: canonical.name,
            description: canonical.description,
            price: canonical.price,
            currency: canonical.currency,
            billingInterval: canonical.billingInterval,
            displayOrder: canonical.displayOrder,
            features: canonical.features,
          },
        ]
      : [],
  })
}