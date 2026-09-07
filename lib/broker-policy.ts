import type { BrokerCreationSource, BrokerStatus, VerificationStatus, Prisma } from '@prisma/client'

export type BrokerPublicState = {
  isVisible: boolean
  verificationStatus: VerificationStatus
  brokerStatus: BrokerStatus
  creationSource?: BrokerCreationSource | null
  userId: string | null
  userIsActive?: boolean
  // True when the owning User is an active member of a Company (an account that
  // "joined as a company" for advertising/service purposes rather than as a
  // genuine mortgage professional). Such accounts are ineligible to be public
  // broker owners and their broker profiles must be excluded from every public
  // broker discovery surface. Mirrors the ownership eligibility enforced by
  // lib/claim-completion.ts (company members cannot attach to a broker).
  hasActiveCompanyMembership?: boolean
  // Canonical profile completeness. A broker must carry the identity + contact
  // fields a public profile actually renders. Absent (undefined) is treated as
  // complete so callers without the full record (e.g. atomic filter helpers
  // that enforce completeness in the query itself) do not over-exclude.
  profileComplete?: boolean
}

export type BrokerEntitlement = {
  // Stable plan code (FREE/FEATURED/PREMIUM or admin-created). The enum is no
  // longer the source of truth; the DB plan config is.
  plan: string
  isActive: boolean
  endDate?: Date | null
}

export type BrokerMortgageExpertState = {
  mortgageExpertEnabled?: boolean | null
  // PROFILE_BADGE entitlement resolved from the active subscription's plan.
  // Computed server-side via the plan feature system; never inferred in React.
  profileBadge?: boolean | null
}

export type BrokerContactIdentity = {
  email?: string | null
  user?: { email?: string | null } | null
}

export function isBrokerOwner(brokerUserId: string | null, userId: string) {
  return brokerUserId !== null && brokerUserId === userId
}

// Canonical profile-completeness rule: the public profile must be able to
// render identity, professional summary, and reachable office info. All five
// fields are guaranteed non-null, non-empty for both admin-created and
// self-registered records at creation; this guard only rejects corrupt or
// leftover stub records.
export function brokerProfileIsComplete(broker: {
  displayName?: string | null
  description?: string | null
  phone?: string | null
  officeAddress?: string | null
  profileSlug?: string | null
}) {
  return [broker.displayName, broker.description, broker.phone, broker.officeAddress, broker.profileSlug]
    .every((value) => typeof value === 'string' && value.trim().length > 0)
}

export function isPublicBroker(state: BrokerPublicState) {
  const ownerEligible =
    state.userId === null ||
    (state.userIsActive === true && state.hasActiveCompanyMembership !== true)
  return state.isVisible &&
    state.brokerStatus !== 'SUSPENDED' &&
    state.profileComplete !== false &&
    ownerEligible
}

// Canonical public marketplace eligibility shared by the broker listing,
// radius search, sitemap, and public detail pages.
//
// Verification is NOT a public eligibility requirement. It is a marker for
// platform-reviewed/admin-published listings (admin-created brokers start
// VERIFIED) and display metadata for the verified badge elsewhere. SELF
// REGISTERED brokers complete a strict onboarding gate (account/email +
// identity, NMLS, licensed states, validated US office) before a Broker record
// is created, with `isVisible` set and the chosen subscription attached — so a
// self-registered broker qualifies for publication exactly like an
// admin-created one: visible, not suspended, profile complete, and owned by an
// active, non-company user (or unowned). Making UNVERIFIED self-registered
// brokers non-public would hide every paid subscriber with no practical path
// to flip the flag (no broker-side or admin workflow exists for them).
//
// Both sources share the visibility, completeness, suspension and ownership
// protections. An owned broker is additionally excluded when its owner is an
// active Company member (an advertising/company account is not a genuine
// mortgage broker owner).
export function publicBrokerWhere(): Prisma.BrokerWhereInput {
  return {
    isVisible: true,
    brokerStatus: { not: 'SUSPENDED' },
    // Canonical profile completeness (mirrors brokerProfileIsComplete).
    displayName: { not: '' },
    description: { not: '' },
    phone: { not: '' },
    officeAddress: { not: '' },
    profileSlug: { not: '' },
    AND: [
      {
        OR: [
          { userId: null },
          { user: { isActive: true, companyMemberships: { none: { isActive: true } } } },
        ],
      },
    ],
  }
}

export function hasActiveEntitlement(subscription?: BrokerEntitlement | null) {
  return !subscription || subscription.plan === 'FREE' || (
    subscription.isActive && (!subscription.endDate || subscription.endDate > new Date())
  )
}

export function hasPaidEntitlement(subscription?: BrokerEntitlement | null) {
  return Boolean(
    subscription?.isActive &&
    subscription.plan === 'FEATURED' &&
    (!subscription.endDate || subscription.endDate > new Date()),
  )
}

// Canonical Mortgage Expert rule, shared by the public listing, broker detail
// pages, and the admin UI. A broker is a Mortgage Expert when their active
// subscription's plan grants the PROFILE_BADGE feature (resolved server-side
// from the admin-managed BrokerSubscriptionPlan configuration) OR an admin has
// explicitly enabled the badge. The two paths are independent: disabling the
// admin badge does not revoke plan-driven qualification, and an enabled badge
// survives a plan change.
export function isMortgageExpertBroker(state: BrokerMortgageExpertState) {
  return state.profileBadge === true || state.mortgageExpertEnabled === true
}

// Canonical server-side allowlist of Broker fields an owning broker may edit
// via PATCH. Ownership, status, metrics, verification, and system-managed
// fields are intentionally excluded — they are never accepted from client input.
export const BROKER_EDITABLE_FIELDS = [
  'displayName',
  'companyName',
  'description',
  'phone',
  'whatsapp',
  'email',
  'website',
  'officeAddress',
  'city',
  'state',
  'pinCode',
  'experienceYears',
  'registrationNumber',
  'panNumber',
  'nmls',
  'licenseStates',
  'logo',
  'coverImage',
  'profileImage',
] as const

// Fields only an ADMIN may set (and only through an admin-authorized PATCH).
export const BROKER_ADMIN_FIELDS = [
  'verificationStatus',
  'verifiedAt',
  'brokerStatus',
  'featuredRank',
  'isVisible',
] as const

// Apply the canonical broker-update allowlist to an arbitrary request body.
// Returns only fields the caller is allowed to set; ownership, metrics,
// status, verification, and system-managed fields are never accepted.
export function pickBrokerEditableFields(body: Record<string, unknown>, isAdmin: boolean) {
  const allowed = new Set<string>([
    ...BROKER_EDITABLE_FIELDS,
    ...(isAdmin ? BROKER_ADMIN_FIELDS : []),
  ])
  const updateData: Record<string, unknown> = {}
  for (const key of Object.keys(body)) {
    if (allowed.has(key)) updateData[key] = body[key]
  }
  return updateData
}

export function getBrokerContactEmail(
  broker: BrokerContactIdentity,
  preferOwner = false,
) {
  return preferOwner
    ? broker.user?.email || broker.email || null
    : broker.email || broker.user?.email || null
}
