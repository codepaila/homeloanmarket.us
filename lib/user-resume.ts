// ===========================================================================
// Canonical user resume destination.
//
// Guarantees that a user who starts (broker or company) registration and leaves
// before completing the flow is NEVER sent to the wrong dashboard, the wrong
// product, or a generic home page when they return.
//
// The resolver is DATABASE-AUTHORITATIVE: it derives the destination from the
// current broker/company product state (registration, subscription, profile,
// membership), never from:
//   - User.role alone (a BROKER role may represent an incomplete registration),
//   - Company.status alone (may be flipped ACTIVE by the Stripe webhook before
//     onboarding completes),
//   - localStorage / client-only state / stale query params,
//   - arbitrary callback URLs.
//
// Product determination follows the existing architecture:
//   - Broker product  -> User.role === 'BROKER' AND a BrokerRegistration or a
//                        final Broker exists (lib/broker-onboarding-state.ts).
//   - Company product -> an active CompanyMembership exists
//                        (lib/company-onboarding-state.ts). There is NO COMPANY
//                        enum role; company users are represented by
//                        User.role === 'USER' + CompanyMembership.
//   - Normal USER     -> neither product.
// ===========================================================================

import prisma from '@/lib/prisma'
import { resolveBrokerOnboardingDestination } from '@/lib/broker-onboarding-state'
import { resolveCompanyOnboardingDestination } from '@/lib/company-onboarding-state'

type ResumeUser = {
  role?: string | null
  brokerProfile?: unknown | null
  brokerRegistration?: {
    subscription?: { isActive?: boolean | null; status?: string | null } | null
  } | null
  companyMemberships?: Array<{
    company?: {
      status?: string | null
      onboardedAt?: Date | string | null
      subscription?: { status?: string | null; isActive?: boolean | null } | null
    } | null
  }> | null
}

function isBrokerPath(path: string): boolean {
  // '/brokers' is the PUBLIC broker directory and is never a broker-product
  // resume destination; '/broker' is the protected broker area.
  return path === '/setup'
    || path === '/broker'
    || path.startsWith('/broker/')
    || path.startsWith('/broker-registration')
}

function isCompanyPath(path: string): boolean {
  return path.startsWith('/company')
}

function isAdminPath(path: string): boolean {
  return path === '/admin' || path.startsWith('/admin/')
}

// A normal (non-product) user may be sent to any destination that is not a
// product/admin/legacy-dashboard route.
function isNormalUserPath(path: string): boolean {
  return !isBrokerPath(path) && !isCompanyPath(path) && !isAdminPath(path) && path !== '/dashboard'
}

/**
 * Pure, synchronous resolver over the getCurrentUser() / DB shape.
 *
 * @param user          the current-user-shaped object (role + broker/company state)
 * @param requestedPath an already-sanitized callbackUrl (or null). Honored only
 *                      when it is compatible with the user's current product;
 *                      server-side product state always overrides incompatible
 *                      destinations so onboarding can never be bypassed.
 */
export function resolveUserResumePath(
  user: ResumeUser | null | undefined,
  requestedPath?: string | null,
): string {
  if (!user) return '/'

  // Admin always goes to the admin console (or a compatible admin callback).
  if (user.role === 'ADMIN') {
    return requestedPath && isAdminPath(requestedPath) ? requestedPath : '/admin'
  }

  // BROKER product: role BROKER with a registration or a final Broker.
  // A BROKER role alone is never treated as completion.
  if (user.role === 'BROKER' && (user.brokerRegistration || user.brokerProfile)) {
    if (requestedPath && isBrokerPath(requestedPath)) return requestedPath
    const destination = resolveBrokerOnboardingDestination(user as Parameters<typeof resolveBrokerOnboardingDestination>[0], '/')
    return destination ?? '/setup'
  }

  // COMPANY product: active company membership (membership-based, no COMPANY role).
  const company = user.companyMemberships?.[0]?.company
  if (company) {
    if (requestedPath && isCompanyPath(requestedPath)) return requestedPath
    const destination = resolveCompanyOnboardingDestination(company, '/')
    return destination ?? '/company/onboarding'
  }

  // Normal USER (or a stale BROKER role with no registration/profile).
  if (requestedPath && isNormalUserPath(requestedPath)) return requestedPath
  return '/'
}

// Minimal DB query matching the resume shape above (database-authoritative).
async function loadUserResumeState(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      brokerRegistration: { include: { subscription: true } },
      brokerProfile: { take: 1, select: { id: true } },
      companyMemberships: {
        where: { isActive: true },
        take: 1,
        include: { company: { include: { subscription: true } } },
      },
    },
  })
}

/**
 * Async, DB-authoritative wrapper used at login / auth boundaries (no session
 * exists yet, so getCurrentUser() is unavailable). Queries the current product
 * state and returns the canonical resume destination.
 */
export async function resolveUserResumePathFromDb(
  userId: string | undefined | null,
  requestedPath?: string | null,
): Promise<string> {
  if (!userId) return '/'
  const user = await loadUserResumeState(userId)
  if (!user) return '/'
  return resolveUserResumePath(
    {
      role: user.role,
      brokerProfile: user.brokerProfile[0] ?? null,
      brokerRegistration: user.brokerRegistration ?? null,
      companyMemberships: user.companyMemberships ?? [],
    },
    requestedPath,
  )
}