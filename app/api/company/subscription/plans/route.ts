import { NextResponse } from 'next/server'
import { getActiveCompanyAdvertisingPlans } from '@/lib/company-plan'

export async function GET() {
  const plans = await getActiveCompanyAdvertisingPlans()
  return NextResponse.json({
    plans: plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      price: plan.price,
      currency: plan.currency,
      billingInterval: plan.billingInterval,
      displayOrder: plan.displayOrder,
      features: plan.features,
    })),
  })
}
