// app/company/subscription/select/page.tsx
// Server-rendered advertising plan selection. The redirect decision is made on
// the server using the authoritative company onboarding state machine, so an
// incomplete-profile company can never reach checkout and a company that is
// already an active advertiser is sent to its dashboard.
import { redirect } from 'next/navigation'
import { getCurrentCompany } from '@/lib/company-policy'
import { getCompanyOnboardingStatus } from '@/lib/company-onboarding-state'
import { CompanySubscriptionSelect } from './CompanySubscriptionSelect'

export default async function CompanySubscriptionSelectPage() {
  const current = await getCurrentCompany()
  if (!current) redirect('/auth/signin')

  const status = getCompanyOnboardingStatus(current.company)
  if (status === 'PROFILE_INCOMPLETE') {
    // Company profile must be completed before advertising plan selection.
    redirect('/company/onboarding')
  }
  if (status === 'COMPLETED') {
    // Already an active advertiser — plan selection is not needed.
    redirect('/company/dashboard')
  }

  return <CompanySubscriptionSelect />
}