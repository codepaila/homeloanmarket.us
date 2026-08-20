import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import { backfillAdminCreatedBrokerFreeSubscriptions } from '@/lib/broker-plans'

// Admin-only explicit backfill: create missing FREE subscriptions for
// admin-created/imported brokers. Idempotent, never downgrades, never touches
// Stripe, never touches brokers with unknown creation source.
export async function POST() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const report = await backfillAdminCreatedBrokerFreeSubscriptions()
    return NextResponse.json({ success: true, report })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to backfill FREE subscriptions'
    console.error('Admin broker FREE backfill failed', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}