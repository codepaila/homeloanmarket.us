import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import { SubscriptionService } from '@/lib/subscription'
import { getCorrelationId } from '@/lib/correlation'

export async function POST(request: Request) {
  const admin = await getCurrentUser()
  if (admin?.role !== 'ADMIN') return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  const body = await request.json()
  if (typeof body.brokerId !== 'string' || !body.brokerId) return NextResponse.json({ message: 'brokerId is required' }, { status: 422 })
  const result = await SubscriptionService.syncWithStripe(body.brokerId)
  console.info('Subscription reconciliation completed', { correlationId: getCorrelationId(request), brokerId: body.brokerId, result: result.success })
  return NextResponse.json({ success: result.success, data: result })
}
