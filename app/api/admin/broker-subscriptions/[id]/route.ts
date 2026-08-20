import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import prisma from '@/lib/prisma'
import { linkBrokerSubscriptionToPlan, resolveBrokerPlanByCode } from '@/lib/broker-plans'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params

  const subscription = await prisma.brokerSubscription.findUnique({
    where: { id },
    include: {
      broker: {
        select: {
          id: true,
          displayName: true,
          email: true,
          companyName: true,
          profileSlug: true,
          creationSource: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
      planRef: { include: { features: true } },
    },
  })
  if (!subscription) return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })

  // Determine migration status and the matching dynamic plan (without linking).
  let matchingPlan = null
  let migrationStatus: 'linked' | 'legacy-eligible' | 'unknown' | 'ambiguous' | 'no-plan'
  if (subscription.planId) {
    migrationStatus = 'linked'
  } else {
    const plans = await prisma.brokerSubscriptionPlan.findMany({
      where: { code: subscription.plan },
      include: { features: true },
    })
    const activePlans = plans.filter((plan) => plan.isActive)
    if (plans.length === 0) {
      migrationStatus = 'no-plan'
    } else if (activePlans.length === 1) {
      migrationStatus = 'legacy-eligible'
      matchingPlan = activePlans[0]
    } else {
      migrationStatus = 'ambiguous'
    }
  }

  // Effective entitlements come from the linked dynamic plan only.
  const planRef = subscription.planRef
  const entitlements = planRef
    ? Object.fromEntries(planRef.features.map((feature) => [feature.code, feature.enabled]))
    : {}

  return NextResponse.json({
    subscription: {
      ...subscription,
      migrationStatus,
      matchingPlan,
      entitlements,
    },
  })
}

// Admin-only safe migration: link this subscription to the dynamic plan that
// matches its stored plan code. Never trusts a client planId.
export async function PATCH(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params

  const subscription = await prisma.brokerSubscription.findUnique({
    where: { id },
    select: { id: true, plan: true, planId: true },
  })
  if (!subscription) return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })

  if (subscription.planId) {
    return NextResponse.json({ success: true, message: 'Subscription is already linked.' })
  }

  const plan = await resolveBrokerPlanByCode(subscription.plan)
  if (!plan) {
    return NextResponse.json(
      { error: 'No unique active dynamic plan matches the stored plan code. Migration not performed.' },
      { status: 409 },
    )
  }

  try {
    const updated = await prisma.brokerSubscription.update({
      where: { id },
      data: { planId: plan.id },
      select: { id: true, plan: true, planId: true },
    })
    console.info('Admin linked broker subscription to dynamic plan', { adminId: user.id, subscriptionId: id, planId: plan.id, planCode: plan.code })
    return NextResponse.json({ success: true, subscription: updated, plan: { id: plan.id, code: plan.code } })
  } catch (error) {
    console.error('Admin broker subscription migration failed', error)
    return NextResponse.json({ error: 'Unable to migrate broker subscription' }, { status: 500 })
  }
}