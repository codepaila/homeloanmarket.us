import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import { getCurrentCompany } from '@/lib/company-policy'
import { resolveCompanyOnboardingDestination } from '@/lib/company-onboarding-state'
import { isSameOriginRequest } from '@/lib/origin'
import {
  COMPANY_INTENT_COOKIE,
  companyIntentValue,
  hasCompanyRegistrationIntent,
  establishCompanyForUser,
  CompanyConsentRequiredError,
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
    // State-based canonical redirect (same lifecycle for email + Google): a
    // freshly created company (or one with an incomplete profile) continues to
    // onboarding; a complete profile without an active subscription goes to
    // plan selection; an active advertiser goes to its dashboard. Returning to
    // the app never auto-charges.
    const current = await getCurrentCompany()
    const redirectTo = resolveCompanyOnboardingDestination(current?.company ?? null, '/company/dashboard') || '/company/onboarding'
    const response = NextResponse.json({
      success: true,
      alreadyCompany: result.alreadyCompany,
      redirectTo,
    })
    response.cookies.delete(COMPANY_INTENT_COOKIE)
    return response
  } catch (error) {
    // Explicit legal consent is server-authoritative for the Google company
    // path. The client routes through the company consent step before the
    // intent PUT is re-attempted.
    if (error instanceof CompanyConsentRequiredError) {
      return NextResponse.json(
        { error: 'Legal consent is required before completing company registration', consentRequired: true },
        { status: 403 },
      )
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to complete company registration' },
      { status: 400 },
    )
  }
}
