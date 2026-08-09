import type { BrokerStatus, VerificationStatus, SubscriptionPlan } from '@prisma/client'

export type BrokerPublicState = {
  isVisible: boolean
  verificationStatus: VerificationStatus
  brokerStatus: BrokerStatus
  userId: string | null
  userIsActive?: boolean
}

export type BrokerEntitlement = {
  plan: SubscriptionPlan
  isActive: boolean
  endDate?: Date | null
}

export type BrokerContactIdentity = {
  email?: string | null
  user?: { email?: string | null } | null
}

export function isBrokerOwner(brokerUserId: string | null, userId: string) {
  return brokerUserId !== null && brokerUserId === userId
}

export function isPublicBroker(state: BrokerPublicState) {
  return state.isVisible &&
    state.verificationStatus === 'VERIFIED' &&
    state.brokerStatus !== 'SUSPENDED' &&
    (state.userId === null || state.userIsActive === true)
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
  'specializations',
  'serviceCities',
  'languages',
  'registrationNumber',
  'panNumber',
  'logo',
  'coverImage',
  'isVisible',
] as const

// Fields only an ADMIN may set (and only through an admin-authorized PATCH).
export const BROKER_ADMIN_FIELDS = [
  'verificationStatus',
  'verifiedAt',
  'brokerStatus',
  'featuredRank',
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

// Canonical FREE-tier service-city allowance: FREE = 1 service city, paid
// FEATURED = unlimited. `hasPaidEntitlement` (not `isActive`, which is true
// for every FREE plan) is the authoritative paid gate.
export function maxServiceCitiesForEntitlement(subscription?: BrokerEntitlement | null): number {
  return hasPaidEntitlement(subscription) ? Infinity : 1
}

// Server-side service-city limit check. Returns ok:false (with the canonical
// reason) when the caller exceeds the allowance for the given entitlement.
// A `null`/undefined subscription (e.g. a broker being created, which always
// starts on the FREE plan) resolves to the FREE allowance.
export function assertServiceCityLimit(
  serviceCities: unknown,
  subscription?: BrokerEntitlement | null,
): { ok: true; max: number } | { ok: false; max: number; reason: string } {
  const max = maxServiceCitiesForEntitlement(subscription)
  if (Array.isArray(serviceCities) && serviceCities.length > max) {
    return {
      ok: false,
      max,
      reason: `Free plan limited to ${max} service city. Please upgrade to add more cities.`,
    }
  }
  return { ok: true, max }
}

export function getBrokerContactEmail(
  broker: BrokerContactIdentity,
  preferOwner = false,
) {
  return preferOwner
    ? broker.user?.email || broker.email || null
    : broker.email || broker.user?.email || null
}
