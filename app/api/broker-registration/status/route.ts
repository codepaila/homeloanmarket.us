import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import { getBrokerOnboardingStatus } from '@/lib/broker-onboarding-state'

// Reads the same authoritative broker onboarding state machine used by
// /setup and /broker/dashboard, so the three layers can never disagree about
// whether onboarding is complete.
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const status = getBrokerOnboardingStatus(user)
  if (status === 'COMPLETED') {
    return NextResponse.json({ completed: true, redirectTo: '/broker/dashboard' })
  }

  if (status === null || user.role !== 'BROKER' || !user.brokerRegistration) {
    return NextResponse.json({ error: 'Broker registration intent is required' }, { status: 403 })
  }

  return NextResponse.json({
    completed: false,
    status: user.brokerRegistration.status,
    subscription: user.brokerRegistration.subscription,
    draft: user.brokerRegistration.draft,
  })
}