import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import prisma from '@/lib/prisma'
import {
  getCompanyPlanStats,
  normalizeCompanyPlanInput,
  validateCompanyPlanStripe,
} from '@/lib/company-advertising-plan'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const plan = await prisma.companyAdvertisingPlan.findUnique({ where: { id } })
  if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })

  const stats = await getCompanyPlanStats(id)
  return NextResponse.json({ plan: { ...plan, ...stats } })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const plan = await prisma.companyAdvertisingPlan.findUnique({
    where: { id },
    include: { _count: { select: { subscriptions: true } } },
  })
  if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const input = normalizeCompanyPlanInput(body)
  if (!input) return NextResponse.json({ error: 'Plan name is required' }, { status: 400 })

  // Name must stay unique across plans.
  if (input.name !== plan.name) {
    const conflict = await prisma.companyAdvertisingPlan.findFirst({ where: { name: input.name, id: { not: id } } })
    if (conflict) return NextResponse.json({ error: 'A plan with this name already exists' }, { status: 409 })
  }

  const nextPrice = input.price ?? plan.price
  const nextProductId = input.stripeProductId === undefined ? plan.stripeProductId : input.stripeProductId
  const nextPriceId = input.stripePriceId === undefined ? plan.stripePriceId : input.stripePriceId

  // Detect a destructive Stripe mapping change on a plan that is actively used.
  const hasActiveSubscriptions = await prisma.companySubscription.count({ where: { planId: id, isActive: true } })
  const stripeMappingChanged =
    (input.stripeProductId !== undefined && (input.stripeProductId ?? null) !== plan.stripeProductId) ||
    (input.stripePriceId !== undefined && (input.stripePriceId ?? null) !== plan.stripePriceId) ||
    input.price !== undefined && input.price !== plan.price

  if (hasActiveSubscriptions > 0 && stripeMappingChanged) {
    return NextResponse.json(
      { error: 'This plan has active subscriptions. Changing its Stripe price/product would break active billing. Deactivate the plan or migrate subscribers before changing Stripe configuration.' },
      { status: 409 },
    )
  }

  const stripe = await validateCompanyPlanStripe({
    price: nextPrice,
    stripeProductId: nextProductId,
    stripePriceId: nextPriceId,
  })
  if (!stripe.ok) return NextResponse.json({ error: stripe.message }, { status: 422 })

  try {
    const updated = await prisma.companyAdvertisingPlan.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description === undefined ? plan.description : input.description,
        price: nextPrice,
        currency: input.currency ?? plan.currency,
        billingInterval: input.billingInterval ?? plan.billingInterval,
        stripeProductId: nextProductId,
        stripePriceId: nextPriceId,
        features: input.features ?? plan.features,
        isActive: input.isActive ?? plan.isActive,
        displayOrder: input.displayOrder ?? plan.displayOrder,
      },
    })
    return NextResponse.json({ success: true, plan: updated })
  } catch (error) {
    console.error('Admin company advertising plan update failed', error)
    return NextResponse.json({ error: 'Unable to update plan' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const plan = await prisma.companyAdvertisingPlan.findUnique({
    where: { id },
    include: { _count: { select: { subscriptions: true } } },
  })
  if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })

  if (plan._count.subscriptions > 0) {
    return NextResponse.json(
      { error: 'This plan has active or historical subscriptions. Deactivate it instead.' },
      { status: 409 },
    )
  }

  try {
    await prisma.companyAdvertisingPlan.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Admin company advertising plan delete failed', error)
    return NextResponse.json({ error: 'Unable to delete plan' }, { status: 500 })
  }
}