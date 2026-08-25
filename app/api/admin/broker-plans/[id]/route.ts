// app/api/admin/broker-plans/[id]/route.ts
// Admin-only broker subscription plan get / update / delete.
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import prisma from '@/lib/prisma'
import {
  ALL_BROKER_PLAN_FEATURES,
  normalizePlanCode,
  upsertPlanFeatures,
  validateStripePriceId,
  validateStripeProductId,
  type BrokerPlanFeatureInput,
} from '@/lib/broker-plans'

async function getAdminUser() {
  const user = await getCurrentUser()
  return user?.role === 'ADMIN' ? user : null
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdminUser())) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const plan = await prisma.brokerSubscriptionPlan.findUnique({
    where: { id },
    include: {
      features: true,
      _count: { select: { subscriptions: true } },
    },
  })
  if (!plan) return NextResponse.json({ message: 'Plan not found' }, { status: 404 })
  return NextResponse.json({ plan })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  const { id } = await params

  const plan = await prisma.brokerSubscriptionPlan.findUnique({ where: { id } })
  if (!plan) return NextResponse.json({ message: 'Plan not found' }, { status: 404 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: 'Invalid request body' }, { status: 400 })
  }

  const data: Record<string, unknown> = {}

  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return NextResponse.json({ message: 'Name is required' }, { status: 422 })
    if (name.length > 100) return NextResponse.json({ message: 'Plan name must be 100 characters or fewer' }, { status: 422 })
    data.name = name
  }
  if (body.code !== undefined) {
    const code = normalizePlanCode(body.code)
    if (!code) return NextResponse.json({ message: 'A stable plan code is required' }, { status: 422 })
    if (code.length > 50) return NextResponse.json({ message: 'Plan code must be 50 characters or fewer' }, { status: 422 })
    const conflict = await prisma.brokerSubscriptionPlan.findFirst({ where: { code, id: { not: id } } })
    if (conflict) return NextResponse.json({ message: 'A plan with this code already exists' }, { status: 409 })
    data.code = code
  }
  if (body.description !== undefined) data.description = typeof body.description === 'string' ? body.description : null
  if (body.price !== undefined) data.price = Number.isFinite(Number(body.price)) ? Math.max(0, Math.round(Number(body.price))) : 0
  if (body.billingInterval !== undefined) {
    const ALLOWED_BILLING_INTERVALS = ['day', 'week', 'month', 'year']
    data.billingInterval = typeof body.billingInterval === 'string' && ALLOWED_BILLING_INTERVALS.includes(body.billingInterval)
      ? body.billingInterval
      : 'month'
  }
  if (body.currency !== undefined) data.currency = typeof body.currency === 'string' && body.currency.trim() ? body.currency.trim().toLowerCase() : 'usd'
  if (body.displayOrder !== undefined) data.displayOrder = Number.isFinite(Number(body.displayOrder)) ? Math.round(Number(body.displayOrder)) : 0
  if (body.isActive !== undefined) data.isActive = body.isActive === true

  // Stripe identifiers: empty string clears; otherwise validate.
  if (body.stripeProductId !== undefined) {
    if (typeof body.stripeProductId === 'string' && body.stripeProductId.trim()) {
      const product = await validateStripeProductId(body.stripeProductId.trim())
      if (!product.ok) return NextResponse.json({ message: product.error }, { status: 422 })
      data.stripeProductId = product.id
    } else {
      data.stripeProductId = null
    }
  }
  if (body.stripePriceId !== undefined) {
    if (typeof body.stripePriceId === 'string' && body.stripePriceId.trim()) {
      const price = await validateStripePriceId(body.stripePriceId.trim(), (data.stripeProductId as string) || plan.stripeProductId || undefined)
      if (!price.ok) return NextResponse.json({ message: price.error }, { status: 422 })
      data.stripePriceId = price.id
    } else {
      data.stripePriceId = null
    }
  }

  // Guard the free→paid transition: converting a FREE plan into a paid plan
  // without connecting a Stripe Product/Price would make checkout unresolvable.
  // Existing paid plans keep their stored (possibly not-yet-connected) mapping.
  const resultingPrice = body.price !== undefined ? (data.price as number) : plan.price
  const resultingProductId = body.stripeProductId !== undefined ? (data.stripeProductId as string | null) : plan.stripeProductId
  const resultingPriceId = body.stripePriceId !== undefined ? (data.stripePriceId as string | null) : plan.stripePriceId
  if (resultingPrice > 0 && plan.price <= 0 && (!resultingProductId || !resultingPriceId)) {
    return NextResponse.json(
      { message: 'Paid plans require a Stripe Product ID and a Stripe Price ID.' },
      { status: 422 },
    )
  }

  // Detect a destructive Stripe mapping change on a plan that is actively used.
  // Mirrors the CompanyAdvertisingPlan guard: changing the Stripe Product/Price
  // (or the DB price that drives checkout amount) under active subscribers would
  // desync the stored plan from the live Stripe subscription tied to the old Price.
  const hasActiveSubscriptions = await prisma.brokerSubscription.count({
    where: { planId: id, isActive: true },
  })
  const stripeMappingChanged =
    (body.stripeProductId !== undefined && (data.stripeProductId ?? null) !== plan.stripeProductId) ||
    (body.stripePriceId !== undefined && (data.stripePriceId ?? null) !== plan.stripePriceId) ||
    (body.price !== undefined && (data.price as number) !== plan.price)

  if (hasActiveSubscriptions > 0 && stripeMappingChanged) {
    return NextResponse.json(
      { message: 'This plan has active subscriptions. Changing its Stripe price/product would break active billing. Deactivate the plan or migrate subscribers before changing Stripe configuration.' },
      { status: 409 },
    )
  }

  // Do not allow deactivating a plan that still has active subscriptions.
  if (body.isActive === false && hasActiveSubscriptions > 0) {
    return NextResponse.json(
      { message: 'This plan has active subscriptions. Deactivate those subscriptions before deactivating the plan.' },
      { status: 409 },
    )
  }

  const features: BrokerPlanFeatureInput = {}
  for (const featureCode of ALL_BROKER_PLAN_FEATURES) {
    if (typeof body[`feature_${featureCode}`] === 'boolean') {
      features[featureCode] = body[`feature_${featureCode}`] as boolean
    }
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.brokerSubscriptionPlan.update({ where: { id }, data })
      if (Object.keys(features).length > 0) {
        await upsertPlanFeatures(tx as never, id, features)
      }
      return result
    })
    console.info('Admin updated broker plan', { adminId: admin.id, planId: id })
    return NextResponse.json({ plan: updated })
  } catch (error) {
    console.error('Admin broker plan update failed', error)
    return NextResponse.json({ message: 'Unable to update broker plan' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  const { id } = await params

  const plan = await prisma.brokerSubscriptionPlan.findUnique({
    where: { id },
    include: { _count: { select: { subscriptions: true } } },
  })
  if (!plan) return NextResponse.json({ message: 'Plan not found' }, { status: 404 })

  if (plan._count.subscriptions > 0) {
    return NextResponse.json(
      { message: 'This plan has active or historical subscriptions. Deactivate it instead.' },
      { status: 409 },
    )
  }

  try {
    await prisma.brokerSubscriptionPlan.delete({ where: { id } })
    console.info('Admin deleted broker plan', { adminId: admin.id, planId: id })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Admin broker plan delete failed', error)
    return NextResponse.json({ message: 'Unable to delete broker plan' }, { status: 500 })
  }
}