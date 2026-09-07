// ===========================================================================
// Authoritative company advertising onboarding state machine.
//
// Derived entirely from existing canonical database fields — no new states or
// columns are invented:
//   - Company profile completion  => Company.onboardedAt set (onboarding PATCH
//     validates every required field and sets status=ACTIVE + onboardedAt).
//   - Advertising billing         => CompanySubscription.status/isActive
//     (CHECKOUT_PENDING / ACTIVE, maintained by the Stripe lifecycle).
//
// States:
//   PROFILE_INCOMPLETE  Company exists but the required profile is incomplete.
//   PROFILE_COMPLETE    Profile complete, no active advertising subscription
//                       (and not currently awaiting checkout).
//   CHECKOUT_PENDING    Profile complete, a company checkout was started but
//                       Stripe has not confirmed an active subscription.
//   COMPLETED           CompanySubscription is ACTIVE (advertising granted).
//
// PRECEDENCE: profile completion is evaluated FIRST, independently of billing.
// A Stripe-created ACTIVE subscription never proves onboarding is complete
// (updateCompanySubscriptionFromStripe flips Company.status to ACTIVE for a
// company that activated billing before finishing its profile), so an active
// subscriber with an incomplete profile is PROFILE_INCOMPLETE -> onboarding.
//
// The company DASHBOARD is intentionally account-level access and is NOT gated
// by this machine (a non-subscriber company may still view its account and its
// incomplete-profile banner). This machine gates the *advertising* entry
// points (plan selection, post-auth routing): profile must be complete before
// a company can select/checkout an advertising plan.
// ===========================================================================

export type CompanyOnboardingStatus =
  | 'NOT_STARTED'
  | 'PROFILE_INCOMPLETE'
  | 'PROFILE_COMPLETE'
  | 'CHECKOUT_PENDING'
  | 'COMPLETED'

// Loose shape of the company row as exposed by getCurrentCompany /
// getCurrentUser (companyMemberships[0].company).
export type CompanyOnboardingStateLike = {
  status?: string | null
  onboardedAt?: Date | string | null
  subscription?: { status?: string | null; isActive?: boolean | null } | null
} | null | undefined

export function isCompanyProfileComplete(
  company: CompanyOnboardingStateLike,
): boolean {
  if (!company) return false
  // `onboardedAt` is set ONLY by the onboarding completion PATCH (which also
  // validates every required field). Company.status may be flipped to ACTIVE by
  // the Stripe webhook for a company that activated billing before onboarding,
  // so status alone is never proof of a completed profile.
  return company.status === 'ACTIVE' && Boolean(company.onboardedAt)
}

export function getCompanyOnboardingStatus(
  company: CompanyOnboardingStateLike,
): CompanyOnboardingStatus | null {
  if (!company) return null
  // Onboarding completion is checked FIRST and independently of billing: a
  // Stripe-created ACTIVE subscription never proves that the required company
  // profile is complete. Billing state and onboarding state stay independent.
  if (!isCompanyProfileComplete(company)) {
    return 'PROFILE_INCOMPLETE'
  }
  if (company.subscription?.status === 'ACTIVE' && company.subscription.isActive) {
    return 'COMPLETED'
  }
  if (company.subscription?.status === 'CHECKOUT_PENDING') {
    return 'CHECKOUT_PENDING'
  }
  return 'PROFILE_COMPLETE'
}

/**
 * Canonical destination for a company at a given onboarding state.
 * `null` means the caller's page is already correct.
 *
 * PROFILE_INCOMPLETE  -> /company/onboarding
 * PROFILE_COMPLETE    -> /company/subscription/select  (profile complete, pick a plan)
 * CHECKOUT_PENDING    -> /company/subscription/select  (recover/resume checkout)
 * COMPLETED           -> /company/dashboard
 */
export function companyOnboardingDestination(
  company: CompanyOnboardingStateLike,
  currentPath: string,
): string | null {
  const status = getCompanyOnboardingStatus(company)
  switch (status) {
    case 'PROFILE_INCOMPLETE':
      return currentPath === '/company/onboarding' ? null : '/company/onboarding'
    case 'PROFILE_COMPLETE':
    case 'CHECKOUT_PENDING':
      return currentPath === '/company/subscription/select' ? null : '/company/subscription/select'
    case 'COMPLETED':
      return currentPath === '/company/dashboard' ? null : '/company/dashboard'
    default:
      return null
  }
}

/** Convenience wrapper for pages that render one canonical destination. */
export function resolveCompanyOnboardingDestination(
  company: CompanyOnboardingStateLike,
  currentPath: string,
): string | null {
  return companyOnboardingDestination(company, currentPath)
}