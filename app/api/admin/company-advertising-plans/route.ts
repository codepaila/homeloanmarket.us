import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import prisma from '@/lib/prisma'
import {
  getCompanyPlanStats,
  normalizeCompanyPlanInput,
  validateCompanyPlanStripe,
} from '@/lib/company-advertising-plan'

export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const plans = await prisma.companyAdvertisingPlan.findMany({
    include: { _count: { select: { subscriptions: true } } },
    orderBy: [{ displayOrder: 'asc' }, { price: 'asc' }, { name: 'asc' }],
  })

  const stats = await Promise.all(plans.map((plan) => getCompanyPlanStats(plan.id)))
  const summary = {
    activePlans: plans.filter((plan) => plan.isActive).length,
    inactivePlans: plans.filter((plan) => !plan.isActive).length,
    activeSubscribers: await prisma.companySubscription.count({ where: { isActive: true } }),
    pendingRequests: await prisma.companyAdRequest.count({ where: { status: 'REQUESTED' } }),
  }

  return NextResponse.json({
    plans: plans.map((plan, index) => ({ ...plan, ...stats[index] })),
    summary,
  })
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const input = normalizeCompanyPlanInput(body)
  if (!input) return NextResponse.json({ error: 'Plan name is required' }, { status: 400 })

  const existing = await prisma.companyAdvertisingPlan.findUnique({ where: { name: input.name } })
  if (existing) return NextResponse.json({ error: 'A plan with this name already exists' }, { status: 409 })

  const stripe = await validateCompanyPlanStripe({
    price: input.price ?? 0,
    stripeProductId: input.stripeProductId,
    stripePriceId: input.stripePriceId,
  })
  if (!stripe.ok) return NextResponse.json({ error: stripe.message }, { status: 422 })

  try {
    const plan = await prisma.companyAdvertisingPlan.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        price: input.price ?? 0,
        currency: input.currency ?? 'usd',
        billingInterval: input.billingInterval ?? 'month',
        stripeProductId: input.stripeProductId ?? null,
        stripePriceId: input.stripePriceId ?? null,
        features: input.features ?? [],
        isActive: input.isActive ?? true,
        displayOrder: input.displayOrder ?? 0,
      },
    })
    return NextResponse.json({ success: true, plan }, { status: 201 })
  } catch (error) {
    console.error('Admin company advertising plan create failed', error)
    return NextResponse.json({ error: 'Unable to create plan' }, { status: 500 })
  }
}