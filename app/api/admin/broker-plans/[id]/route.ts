// app/api/admin/broker-plans/[id]/route.ts
// Admin-only broker subscription plan get / update / delete.
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import prisma from '@/lib/prisma'
import {
  getBrokerPlanDisplayName,
  normalizePlanCode,
  sanitizeFeatureDrafts,
  syncPlanFeatures,
  validateStripePriceId,
  validateStripeProductId,
} from '@/lib/broker-plans'
import { assertStripePriceIsolation } from '@/lib/plan-price-isolation'

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
  return NextResponse.json({ plan: { ...plan, displayName: getBrokerPlanDisplayName(plan.code) || plan.name } })
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

  // Plan identity (code) is immutable. Any attempt to change it into another
  // fixed plan (FREE->FEATURED, FEATURED->FREE) is rejected.
  if (body.code !== undefined) {
    const code = normalizePlanCode(body.code)
    if (code && code !== plan.code) {
      return NextResponse.json({ message: 'Plan identity cannot be changed.' }, { status: 400 })
    }
  }
  // The customer-facing name is derived from the fixed plan identity and may
  // not be overridden with arbitrary input. Supported fixed plans always store
  // their canonical name. Legacy/unsupported plans keep their stored name.
  const canonicalName = getBrokerPlanDisplayName(plan.code)
  if (canonicalName && typeof body.name === 'string' && body.name.trim() && body.name.trim() !== canonicalName) {
    return NextResponse.json({ message: 'Plan name is derived from the fixed plan identity and cannot be changed.' }, { status: 400 })
  }
  if (canonicalName) data.name = canonicalName

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

  // Product isolation: the resulting Broker Price must not already be assigned
  // to a Company advertising plan (excluding this very plan).
  const isolation = await assertStripePriceIsolation(resultingPriceId, 'BROKER', id)
  if (!isolation.ok) return NextResponse.json({ message: isolation.message }, { status: 422 })

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

  // Features are submitted as a full list of display rows. A request that
  // includes `features` performs a full sync (create/update/delete); a request
  // without it (e.g. a deactivate toggle) leaves features untouched.
  let features: ReturnType<typeof sanitizeFeatureDrafts> = null
  let hasFeatures = false
  if (body.features !== undefined) {
    hasFeatures = true
    features = sanitizeFeatureDrafts(body.features)
    if (features === null) {
      return NextResponse.json(
        { message: 'Features must be an array of { id?, label, enabled, sortOrder } with a non-empty label.' },
        { status: 422 },
      )
    }
    // Every submitted feature ID must belong to this plan.
    const owned = new Set((await prisma.brokerSubscriptionPlanFeature.findMany({ where: { planId: id }, select: { id: true } })).map((f) => f.id))
    const foreign = features.filter((f) => f.id && !owned.has(f.id))
    if (foreign.length > 0) {
      return NextResponse.json(
        { message: 'One or more features do not belong to this plan.' },
        { status: 422 },
      )
    }
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.brokerSubscriptionPlan.update({ where: { id }, data })
      if (hasFeatures) {
        await syncPlanFeatures(tx as never, id, features!)
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
