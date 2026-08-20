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

async function isAdmin() {
  const user = await getCurrentUser()
  return user?.role === 'ADMIN'
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
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
  if (!(await isAdmin())) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
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
    data.name = name
  }
  if (body.code !== undefined) {
    const code = normalizePlanCode(body.code)
    if (!code) return NextResponse.json({ message: 'A stable plan code is required' }, { status: 422 })
    const conflict = await prisma.brokerSubscriptionPlan.findFirst({ where: { code, id: { not: id } } })
    if (conflict) return NextResponse.json({ message: 'A plan with this code already exists' }, { status: 409 })
    data.code = code
  }
  if (body.description !== undefined) data.description = typeof body.description === 'string' ? body.description : null
  if (body.price !== undefined) data.price = Number.isFinite(Number(body.price)) ? Math.max(0, Math.round(Number(body.price))) : 0
  if (body.billingInterval !== undefined) data.billingInterval = typeof body.billingInterval === 'string' ? body.billingInterval : 'month'
  if (body.currency !== undefined) data.currency = typeof body.currency === 'string' ? body.currency : 'usd'
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
    return NextResponse.json({ plan: updated })
  } catch (error) {
    console.error('Admin broker plan update failed', error)
    return NextResponse.json({ message: 'Unable to update broker plan' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
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
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Admin broker plan delete failed', error)
    return NextResponse.json({ message: 'Unable to delete broker plan' }, { status: 500 })
  }
}