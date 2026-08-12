import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import { isSameOriginRequest } from '@/lib/origin'
import { BROKER_INTENT_COOKIE, brokerIntentValue, establishBrokerRegistration, hasBrokerRegistrationIntent } from '@/lib/broker-intent'

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }

  const response = NextResponse.json({ success: true })
  response.cookies.set(BROKER_INTENT_COOKIE, brokerIntentValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 15 * 60,
  })
  return response
}

export async function PUT(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }

  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await hasBrokerRegistrationIntent())) {
    return NextResponse.json({ error: 'Broker registration intent is required' }, { status: 403 })
  }

  try {
    const result = await establishBrokerRegistration(user.id)
    const response = NextResponse.json({
      success: true,
      alreadyBroker: result.alreadyBroker,
      redirectTo: result.alreadyBroker ? '/broker/dashboard' : '/broker/subscription/select',
    })
    response.cookies.delete(BROKER_INTENT_COOKIE)
    return response
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to start broker registration' },
      { status: 400 },
    )
  }
}
