import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import { reconcileBrokerSubscriptions } from '@/lib/broker-plans'

// Admin-only bulk reconciliation of legacy broker subscriptions against the
// dynamic plan records. Idempotent and non-destructive.
export async function POST() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const report = await reconcileBrokerSubscriptions()
    return NextResponse.json({ success: true, report })
  } catch (error) {
    console.error('Admin broker subscription reconciliation failed', error)
    return NextResponse.json({ error: 'Unable to reconcile broker subscriptions' }, { status: 500 })
  }
}