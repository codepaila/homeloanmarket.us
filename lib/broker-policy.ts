import type { BrokerCreationSource, BrokerStatus, VerificationStatus, Prisma } from '@prisma/client'

export type BrokerPublicState = {
  isVisible: boolean
  verificationStatus: VerificationStatus
  brokerStatus: BrokerStatus
  creationSource?: BrokerCreationSource | null
  userId: string | null
  userIsActive?: boolean
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

export function isPublicBroker(state: BrokerPublicState) {
  const sourceEligible = state.creationSource === 'ADMIN_CREATED' || state.verificationStatus === 'VERIFIED'
  return state.isVisible &&
    state.brokerStatus !== 'SUSPENDED' &&
    (state.userId === null || state.userIsActive === true) &&
    sourceEligible
}

// Canonical public marketplace eligibility shared by the broker listing,
// radius search, and sitemap. ADMIN_CREATED brokers are platform-published
// marketplace profiles that may be unowned and do not go through the
// self-registration verification lifecycle, so they are public unless they are
// suspended or hard-hidden via `isVisible`. SELF_REGISTERED brokers must still
// be VERIFIED and visible. Both branches share the suspension and ownership
// protections.
export function publicBrokerWhere(): Prisma.BrokerWhereInput {
  return {
    isVisible: true,
    brokerStatus: { not: 'SUSPENDED' },
    AND: [
      { OR: [{ userId: null }, { user: { isActive: true } }] },
      { OR: [{ creationSource: 'ADMIN_CREATED' }, { verificationStatus: 'VERIFIED' }] },
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
  'profileSlug',
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
