import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import { isSameOriginRequest } from '@/lib/origin'
import {
  COMPANY_INTENT_COOKIE,
  companyIntentValue,
  hasCompanyRegistrationIntent,
  establishCompanyForUser,
} from '@/lib/company-intent'

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }

  const response = NextResponse.json({ success: true })
  response.cookies.set(COMPANY_INTENT_COOKIE, companyIntentValue(), {
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
  if (!(await hasCompanyRegistrationIntent())) {
    return NextResponse.json({ error: 'Company registration intent is required' }, { status: 403 })
  }

  try {
    const result = await establishCompanyForUser(user.id)
    const response = NextResponse.json({
      success: true,
      alreadyCompany: result.alreadyCompany,
      redirectTo: '/company/subscription/select',
    })
    response.cookies.delete(COMPANY_INTENT_COOKIE)
    return response
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to complete company registration' },
      { status: 400 },
    )
  }
}
