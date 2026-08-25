import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import prisma from '@/lib/prisma'
import {
  ALLOWED_BILLING_INTERVALS,
  getCompanyPlanStats,
  validateCompanyPlanStripe,
  type CompanyBillingInterval,
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

  // Partial update: only fields present in the body are applied. This keeps
  // single-purpose admin actions (e.g. activate/deactivate) working without
  // requiring the entire plan payload or resetting omitted fields.
  const body: Record<string, unknown> = await request.json().catch(() => ({}))
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const update: {
    name?: string
    description?: string | null
    price?: number
    currency?: string
    billingInterval?: string
    stripeProductId?: string | null
    stripePriceId?: string | null
    features?: string[]
    isActive?: boolean
    displayOrder?: number
  } = {}

  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return NextResponse.json({ error: 'Plan name is required' }, { status: 400 })
    if (name.length > 100) return NextResponse.json({ error: 'Plan name must be 100 characters or fewer' }, { status: 422 })
    update.name = name
  }
  if (body.description !== undefined) update.description = body.description === null ? null : String(body.description)
  if (body.price !== undefined) {
    const price = Number.isFinite(Number(body.price)) ? Math.max(0, Math.round(Number(body.price))) : 0
    update.price = price
  }
  if (body.currency !== undefined) update.currency = typeof body.currency === 'string' && body.currency.trim() ? body.currency.trim().toLowerCase() : 'usd'
  if (body.billingInterval !== undefined) {
    update.billingInterval = typeof body.billingInterval === 'string' && ALLOWED_BILLING_INTERVALS.includes(body.billingInterval as CompanyBillingInterval)
      ? body.billingInterval
      : 'month'
  }
  if (body.displayOrder !== undefined) update.displayOrder = Number.isFinite(Number(body.displayOrder)) ? Math.round(Number(body.displayOrder)) : 0
  if (body.isActive !== undefined) update.isActive = body.isActive === true
  if (body.features !== undefined) {
    update.features = Array.isArray(body.features) ? body.features.filter((feature): feature is string => typeof feature === 'string') : []
  }
  if (body.stripeProductId !== undefined) update.stripeProductId = typeof body.stripeProductId === 'string' && body.stripeProductId.trim() ? body.stripeProductId.trim() : null
  if (body.stripePriceId !== undefined) update.stripePriceId = typeof body.stripePriceId === 'string' && body.stripePriceId.trim() ? body.stripePriceId.trim() : null

  // Name must stay unique across plans.
  if (update.name !== undefined && update.name !== plan.name) {
    const conflict = await prisma.companyAdvertisingPlan.findFirst({ where: { name: update.name, id: { not: id } } })
    if (conflict) return NextResponse.json({ error: 'A plan with this name already exists' }, { status: 409 })
  }

  const nextPrice = update.price !== undefined ? update.price : plan.price
  const nextProductId = update.stripeProductId !== undefined ? update.stripeProductId : plan.stripeProductId
  const nextPriceId = update.stripePriceId !== undefined ? update.stripePriceId : plan.stripePriceId

  // Detect a destructive Stripe mapping change on a plan that is actively used.
  const hasActiveSubscriptions = await prisma.companySubscription.count({ where: { planId: id, isActive: true } })
  const stripeMappingChanged =
    (update.stripeProductId !== undefined && (update.stripeProductId ?? null) !== plan.stripeProductId) ||
    (update.stripePriceId !== undefined && (update.stripePriceId ?? null) !== plan.stripePriceId) ||
    (update.price !== undefined && update.price !== plan.price)

  if (hasActiveSubscriptions > 0 && stripeMappingChanged) {
    return NextResponse.json(
      { error: 'This plan has active subscriptions. Changing its Stripe price/product would break active billing. Deactivate the plan or migrate subscribers before changing Stripe configuration.' },
      { status: 409 },
    )
  }

  // Do not allow deactivating a plan that still has active subscriptions.
  if (update.isActive === false && hasActiveSubscriptions > 0) {
    return NextResponse.json(
      { error: 'This plan has active subscriptions. Deactivate those subscriptions before deactivating the plan.' },
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
        name: update.name ?? plan.name,
        description: update.description !== undefined ? update.description : plan.description,
        price: nextPrice,
        currency: update.currency ?? plan.currency,
        billingInterval: update.billingInterval ?? plan.billingInterval,
        stripeProductId: nextProductId,
        stripePriceId: nextPriceId,
        features: update.features ?? plan.features,
        isActive: update.isActive ?? plan.isActive,
        displayOrder: update.displayOrder ?? plan.displayOrder,
      },
    })
    console.info('Admin updated company advertising plan', { adminId: user.id, planId: id })
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
    console.info('Admin deleted company advertising plan', { adminId: user.id, planId: id })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Admin company advertising plan delete failed', error)
    return NextResponse.json({ error: 'Unable to delete plan' }, { status: 500 })
  }
}