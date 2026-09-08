import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import { verifyBrokerRegistrationCheckout } from '@/lib/broker-registration-verify'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  const sessionId = request.nextUrl.searchParams.get('session_id') || ''
  const result = await verifyBrokerRegistrationCheckout({ user, sessionId })

  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: result.status })
  }

  // Compatibility response. The server-side success return page performs the
  // finalization + dashboard redirect directly; this API keeps the
  // `/setup` fallback (where the Phase 8.35 auto-finalization recovery runs).
  return NextResponse.json({ success: true, plan: result.plan, redirectTo: '/setup' })
}