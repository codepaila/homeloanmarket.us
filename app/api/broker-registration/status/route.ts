import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import { isBrokerSetupComplete } from '@/lib/broker-onboarding-state'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (isBrokerSetupComplete(user)) return NextResponse.json({ completed: true, redirectTo: '/broker/dashboard' })
  if (user.role !== 'BROKER' || !user.brokerRegistration) {
    return NextResponse.json({ error: 'Broker registration intent is required' }, { status: 403 })
  }

  return NextResponse.json({
    completed: false,
    status: user.brokerRegistration.status,
    subscription: user.brokerRegistration.subscription,
    draft: user.brokerRegistration.draft,
  })
}
