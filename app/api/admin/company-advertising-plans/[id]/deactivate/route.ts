import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import prisma from '@/lib/prisma'
import { PlanDeactivationError, SubscriptionService } from '@/lib/subscription'

// Explicit "Deactivate plan and cancel active subscriptions" operation.
//
// Unlike a plain PATCH isActive=false (which is blocked while active
// subscribers exist), this endpoint performs the controlled orchestration:
//   1. Authenticate the admin.
//   2. Delegate to the canonical SubscriptionService, which locks the plan,
//      cancels every active Company Advertising subscription with deterministic
//      idempotency keys, reconciles local state, and only then deactivates the
//      plan. Stripe Product/Price are never touched.
//   3. On partial failure the plan is LEFT ACTIVE and the failed company
//      subscription IDs are returned so the admin can act and retry safely.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const plan = await prisma.companyAdvertisingPlan.findUnique({ where: { id } })
  if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })

  try {
    const result = await SubscriptionService.deactivateCompanyAdvertisingPlan(id)
    if (!result.deactivated) {
      return NextResponse.json({ error: 'This plan is already deactivated' }, { status: 409 })
    }
    console.info('Admin deactivated company advertising plan and cancelled its subscriptions', { adminId: user.id, planId: id, cancelledSubscriptions: result.cancelledSubscriptions })
    return NextResponse.json({ success: true, cancelledSubscriptions: result.cancelledSubscriptions })
  } catch (error) {
    if (error instanceof PlanDeactivationError) {
      return NextResponse.json(
        { error: error.message, failedCompanySubscriptionIds: error.failedCompanySubscriptionIds },
        { status: 409 },
      )
    }
    console.error('Company advertising plan deactivation failed', { adminId: user.id, planId: id, error: error instanceof Error ? error.message : 'Unknown error' })
    return NextResponse.json({ error: 'Unable to deactivate plan' }, { status: 500 })
  }
}
