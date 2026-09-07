// app/company/onboarding/page.tsx
// Server-rendered company onboarding. The redirect decision is made on the
// server using the authoritative company onboarding state machine, so a company
// that has already completed its profile (or is an active advertiser) is never
// shown the onboarding form, and a non-company user is never allowed in.
import { redirect } from 'next/navigation'
import { getCurrentCompany } from '@/lib/company-policy'
import { getCompanyOnboardingStatus } from '@/lib/company-onboarding-state'
import { CompanyOnboarding } from './CompanyOnboarding'

export default async function CompanyOnboardingPage() {
  const current = await getCurrentCompany()
  if (!current) redirect('/auth/signin')

  const status = getCompanyOnboardingStatus(current.company)
  // Company profile already complete (no active subscription) -> plan selection.
  if (status === 'PROFILE_COMPLETE' || status === 'CHECKOUT_PENDING') {
    redirect('/company/subscription/select')
  }
  // Already an active advertiser -> dashboard.
  if (status === 'COMPLETED') {
    redirect('/company/dashboard')
  }

  // PROFILE_INCOMPLETE (and NOT_STARTED/null) render onboarding.
  return <CompanyOnboarding />
}