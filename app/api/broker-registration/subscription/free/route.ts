import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import { isSameOriginRequest } from '@/lib/origin'
import prisma from '@/lib/prisma'
import { SubscriptionService } from '@/lib/subscription'

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }

  const user = await getCurrentUser()
  if (!user || user.role !== 'BROKER') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.brokerProfile) return NextResponse.json({ success: true, redirectTo: '/broker/dashboard', completed: true })
  if (!user.brokerRegistration) return NextResponse.json({ error: 'Broker registration not found' }, { status: 404 })

  try {
    const result = await SubscriptionService.withBillingLock(`broker-registration:${user.brokerRegistration.id}`, async () => {
      const current = await prisma.brokerRegistrationSubscription.findUnique({
        where: { registrationId: user.brokerRegistration!.id },
      })
      if (current?.status === 'ACTIVE' && current.plan === 'FEATURED') {
        throw new Error('An existing FEATURED subscription must be managed before selecting FREE')
      }
      const subscription = await prisma.brokerRegistrationSubscription.upsert({
        where: { registrationId: user.brokerRegistration!.id },
        update: { plan: 'FREE', status: 'ACTIVE', isActive: true, startDate: new Date(), endDate: null, stripeSubId: null, stripeCustomerId: null },
        create: { registrationId: user.brokerRegistration!.id, plan: 'FREE', status: 'ACTIVE', isActive: true, startDate: new Date() },
      })
      await prisma.brokerRegistration.update({
        where: { id: user.brokerRegistration!.id },
        data: { status: 'ONBOARDING_IN_PROGRESS' },
      })
      return { subscription, redirectTo: '/setup' }
    })

    return NextResponse.json({
      success: true,
      plan: result.subscription.plan,
      redirectTo: result.redirectTo,
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to select FREE' }, { status: 409 })
  }
}
