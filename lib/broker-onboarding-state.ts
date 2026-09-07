import { roleHome } from '@/lib/auth-redirect'

// ===========================================================================
// Authoritative broker onboarding state machine.
//
// Every broker navigation layer (the `/setup` page, the `/broker/dashboard`
// page, and the `/api/broker-registration/status` endpoint) derives its
// redirect decision from `resolveBrokerOnboardingDestination`. This is the
// single source of truth so `/setup` and `/broker/dashboard` can never make
// conflicting redirect decisions from the same server-side snapshot — the
// historical cause of the `/setup` ↔ `/broker/dashboard` redirect loop.
//
// The existing schema already carries enough information; no Prisma change is
// required:
//   - a Broker profile existing  => onboarding COMPLETED
//   - BrokerRegistration + active subscription + no profile => ONBOARDING_IN_PROGRESS
//     (with or without a saved BrokerOnboardingDraft)
//   - BrokerRegistration with a non-active subscription => SUBSCRIPTION_PENDING
//   - BROKER role with no registration at all => NOT_STARTED
// ===========================================================================

export type BrokerOnboardingStatus =
  | 'NOT_STARTED'
  | 'SUBSCRIPTION_PENDING'
  | 'ONBOARDING_IN_PROGRESS'
  | 'COMPLETED'

type OnboardingUser = {
  role?: string | null
  brokerProfile?: unknown | null
  brokerRegistration?: {
    subscription?: { isActive?: boolean | null; status?: string | null } | null
  } | null
}

export function isBrokerSetupComplete<T extends { brokerProfile?: unknown | null }>(
  user: T,
): user is T & { brokerProfile: NonNullable<T['brokerProfile']> } {
  return Boolean(user.brokerProfile)
}

export function getBrokerOnboardingStatus<T extends OnboardingUser>(
  user: T | null | undefined,
): BrokerOnboardingStatus | null {
  if (!user) return null
  if (isBrokerSetupComplete(user)) return 'COMPLETED'
  if (user.role !== 'BROKER') return null
  if (!user.brokerRegistration) return 'NOT_STARTED'
  const subscription = user.brokerRegistration.subscription
  if (!subscription?.isActive || subscription.status !== 'ACTIVE') return 'SUBSCRIPTION_PENDING'
  return 'ONBOARDING_IN_PROGRESS'
}

/**
 * The single canonical landing page for a broker at any onboarding state.
 * `null` means the caller's page is already the correct destination.
 */
export function brokerOnboardingDestination<T extends OnboardingUser>(
  user: T | null | undefined,
  currentPath: string,
): string | null {
  if (!user) return '/auth/signin'
  const status = getBrokerOnboardingStatus(user)
  if (status === null) {
    const home = roleHome(user.role)
    return home === currentPath ? null : home
  }
  switch (status) {
    case 'COMPLETED':
      return currentPath === '/broker/dashboard' ? null : '/broker/dashboard'
    case 'SUBSCRIPTION_PENDING':
    case 'ONBOARDING_IN_PROGRESS':
      if (currentPath === '/setup' || currentPath === '/broker/subscription/select') {
        return null
      }
      return '/setup'
    case 'NOT_STARTED':
      return currentPath === '/register' ? null : '/register'
  }
}

/**
 * Convenience wrapper used by pages that only ever expect to render one page
 * for an authenticated broker: returns the destination that differs from the
 * page being rendered, or null when the page is correct.
 */
export function resolveBrokerOnboardingDestination<T extends OnboardingUser>(
  user: T | null | undefined,
  currentPath: string,
): string | null {
  return brokerOnboardingDestination(user, currentPath)
}
