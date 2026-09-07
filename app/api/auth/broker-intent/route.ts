import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import { isSameOriginRequest } from '@/lib/origin'
import {
  BROKER_INTENT_COOKIE,
  brokerIntentValue,
  establishBrokerRegistration,
  hasBrokerRegistrationIntent,
  getBrokerRegistrationIntentPlan,
} from '@/lib/broker-intent'

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }

  let plan: string | null = null
  try {
    const body = await request.json()
    if (body && typeof body.plan === 'string' && (body.plan === 'FREE' || body.plan === 'FEATURED')) {
      plan = body.plan
    }
  } catch {
    // Body is optional; callers that omit it continue working.
  }

  const response = NextResponse.json({ success: true })
  response.cookies.set(BROKER_INTENT_COOKIE, brokerIntentValue(plan), {
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

  // Legal-consent gate at the broker registration boundary. A user who already
  // has a broker profile has passed this boundary and continues unimpeded;
  // anyone else (including Google-authenticated users whose account was created
  // by authentication, with no recorded consent) must explicitly accept both
  // the Terms & Conditions and the Privacy Policy before a broker registration
  // can be established. The client is told to route through the consent step.
  if (!user.brokerProfile && (user.agreeToTerms !== true || user.agreeToPrivacy !== true)) {
    return NextResponse.json(
      { error: 'Legal consent is required before completing broker registration', consentRequired: true },
      { status: 403 },
    )
  }

  try {
    const result = await establishBrokerRegistration(user.id)
    let redirectTo = result.alreadyBroker ? '/broker/dashboard' : '/setup'

    if (!result.alreadyBroker) {
      const intentPlan = await getBrokerRegistrationIntentPlan()
      if (intentPlan) {
        redirectTo += `?plan=${intentPlan}`
      }
    }

    const response = NextResponse.json({
      success: true,
      alreadyBroker: result.alreadyBroker,
      redirectTo,
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
