// app/api/admin/broker-plans/route.ts
// Admin-only broker subscription plan management (list + create).
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

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  const plans = await prisma.brokerSubscriptionPlan.findMany({
    include: {
      features: true,
      _count: { select: { subscriptions: true } },
    },
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
  })
  return NextResponse.json({ plans })
}

export async function POST(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: 'Invalid request body' }, { status: 400 })
  }

  const code = normalizePlanCode(body.code)
  if (!code) return NextResponse.json({ message: 'A stable plan code is required' }, { status: 422 })
  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : code
  const description = typeof body.description === 'string' ? body.description : ''
  const price = Number.isFinite(Number(body.price)) ? Math.max(0, Math.round(Number(body.price))) : 0
  const billingInterval = typeof body.billingInterval === 'string' ? body.billingInterval : 'month'
  const currency = typeof body.currency === 'string' ? body.currency : 'usd'
  const displayOrder = Number.isFinite(Number(body.displayOrder)) ? Math.round(Number(body.displayOrder)) : 0
  const isActive = body.isActive !== false

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

  const exists = await prisma.brokerSubscriptionPlan.findUnique({ where: { code } })
  if (exists) return NextResponse.json({ message: 'A plan with this code already exists' }, { status: 409 })

  const features: BrokerPlanFeatureInput = {}
  for (const featureCode of ALL_BROKER_PLAN_FEATURES) {
    if (typeof body[`feature_${featureCode}`] === 'boolean') {
      features[featureCode] = body[`feature_${featureCode}`] as boolean
    }
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
      await upsertPlanFeatures(tx as never, created.id, features)
      return created
    })
    return NextResponse.json({ plan }, { status: 201 })
  } catch (error) {
    console.error('Admin broker plan create failed', error)
    return NextResponse.json({ message: 'Unable to create broker plan' }, { status: 500 })
  }
}