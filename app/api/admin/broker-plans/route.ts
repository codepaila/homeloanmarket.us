// app/api/admin/broker-plans/route.ts
// Admin-only broker subscription plan management (list + create).
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import prisma from '@/lib/prisma'
import {
  SUPPORTED_BROKER_PLAN_CODES,
  getBrokerPlanDisplayName,
  isSupportedBrokerPlanCode,
  createPlanFeatures,
  normalizePlanCode,
  sanitizeFeatureDrafts,
  validateStripePriceId,
  validateStripeProductId,
} from '@/lib/broker-plans'
import { assertStripePriceIsolation } from '@/lib/plan-price-isolation'
import { Prisma } from '@prisma/client'

async function getAdminUser() {
  const user = await getCurrentUser()
  return user?.role === 'ADMIN' ? user : null
}

export async function GET() {
  if (!(await getAdminUser())) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  const plans = await prisma.brokerSubscriptionPlan.findMany({
    include: {
      features: true,
      _count: { select: { subscriptions: true } },
    },
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
  })
  const existingCodes = new Set(plans.map((plan) => plan.code))
  const supportedPlans = SUPPORTED_BROKER_PLAN_CODES.map((code) => ({
    code,
    displayName: getBrokerPlanDisplayName(code) || code,
    exists: existingCodes.has(code),
  }))
  return NextResponse.json({
    plans: plans.map((plan) => ({ ...plan, displayName: getBrokerPlanDisplayName(plan.code) || plan.name })),
    supportedPlans,
  })
}

export async function POST(request: Request) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: 'Invalid request body' }, { status: 400 })
  }

  const code = normalizePlanCode(body.code)
  if (!code) return NextResponse.json({ message: 'A stable plan code is required' }, { status: 422 })
  if (code.length > 50) return NextResponse.json({ message: 'Plan code must be 50 characters or fewer' }, { status: 422 })

  // Only the fixed, supported broker plans (FREE/FEATURED) may be created.
  // Arbitrary plan codes are rejected; the canonical customer-facing name is
  // derived from the fixed plan identity and never trusted from the client.
  if (!isSupportedBrokerPlanCode(code)) {
    return NextResponse.json({ message: 'Unsupported plan. Only FREE and FEATURED plans are supported.' }, { status: 400 })
  }
  const name = getBrokerPlanDisplayName(code)
  if (!name) return NextResponse.json({ message: 'Unsupported plan' }, { status: 400 })
  // The canonical display name may not be overridden by client input.
  if (typeof body.name === 'string' && body.name.trim() && body.name.trim() !== name) {
    return NextResponse.json({ message: 'Plan name is derived from the fixed plan identity and cannot be changed.' }, { status: 400 })
  }
  const description = typeof body.description === 'string' ? body.description : ''
  const price = Number.isFinite(Number(body.price)) ? Math.max(0, Math.round(Number(body.price))) : 0
  const ALLOWED_BILLING_INTERVALS = ['day', 'week', 'month', 'year']
  const billingInterval = typeof body.billingInterval === 'string' && ALLOWED_BILLING_INTERVALS.includes(body.billingInterval)
    ? body.billingInterval
    : 'month'
  const currency = typeof body.currency === 'string' && body.currency.trim() ? body.currency.trim().toLowerCase() : 'usd'
  const displayOrder = Number.isFinite(Number(body.displayOrder)) ? Math.round(Number(body.displayOrder)) : 0
  const isActive = body.isActive === undefined ? true : body.isActive === true

  let stripeProductId: string | null = null
  let stripePriceId: string | null = null

  if (typeof body.stripeProductId === 'string' && body.stripeProductId.trim()) {
    const product = await validateStripeProductId(body.stripeProductId.trim())
    if (!product.ok) return NextResponse.json({ message: product.error }, { status: 422 })
    stripeProductId = product.id
  }
  if (typeof body.stripePriceId === 'string' && body.stripePriceId.trim()) {
    const price = await validateStripePriceId(body.stripePriceId.trim(), stripeProductId || undefined)
    if (!price.ok) return NextResponse.json({ message: price.error }, { status: 422 })
    stripePriceId = price.id
  }

  // Paid plans must reference a valid Stripe Product and Price so checkout can
  // resolve them. This matches the company advertising plan contract and the
  // create form's own guidance.
  if (price > 0 && (!stripeProductId || !stripePriceId)) {
    return NextResponse.json(
      { message: 'Paid plans require a Stripe Product ID and a Stripe Price ID.' },
      { status: 422 },
    )
  }

  // Product isolation: this Broker Price must not already be assigned to a
  // Company advertising plan.
  const isolation = await assertStripePriceIsolation(stripePriceId, 'BROKER')
  if (!isolation.ok) return NextResponse.json({ message: isolation.message }, { status: 422 })

  const exists = await prisma.brokerSubscriptionPlan.findUnique({ where: { code } })
  if (exists) return NextResponse.json({ message: 'A plan with this code already exists' }, { status: 409 })

  const features = sanitizeFeatureDrafts(body.features)
  if (features === null) {
    return NextResponse.json(
      { message: 'Features must be an array of { label, enabled, sortOrder } with a non-empty label.' },
      { status: 422 },
    )
  }

  try {
    const plan = await prisma.$transaction(async (tx) => {
      const created = await tx.brokerSubscriptionPlan.create({
        data: {
          code,
          name,
          description,
          price,
          billingInterval,
          currency,
          stripeProductId,
          stripePriceId,
          isActive,
          displayOrder,
        },
      })
      await createPlanFeatures(tx as never, created.id, features)
      return created
    })
    console.info('Admin created broker plan', { adminId: admin.id, planId: plan.id })
    return NextResponse.json({ plan: { ...plan, displayName: getBrokerPlanDisplayName(plan.code) || plan.name } }, { status: 201 })
  } catch (error) {
    // Concurrent duplicate creation: the unique `code` constraint guarantees
    // only one create succeeds; map the unique violation to a clean conflict.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ message: 'A plan with this code already exists' }, { status: 409 })
    }
    console.error('Admin broker plan create failed', error)
    return NextResponse.json({ message: 'Unable to create broker plan' }, { status: 500 })
  }
}
