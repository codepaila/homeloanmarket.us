// Authoritative access rule for the Request Advertisement feature.
//
// Only an ACTIVE company advertising subscription (CompanySubscription linked
// to a CompanyAdvertisingPlan) grants advertisement-request access.
// CHECKOUT_PENDING, PAST_DUE, CANCELED, EXPIRED, an inactive row, and a
// missing subscription are all blocked. Onboarding state is deliberately NOT
// part of this decision: a company may skip onboarding, but it still needs an
// active advertising subscription to request an advertisement.
//
// This module stays free of server-only imports so the API route (server-side
// enforcement) and the dashboard client (UI state) share the exact same rule.
// The database remains authoritative; the client copy is display-only.

export const SUBSCRIPTION_REQUIRED_ERROR_CODE = 'SUBSCRIPTION_REQUIRED'

export type CompanySubscriptionStateLike = {
  status?: string | null
  isActive?: boolean | null
} | null | undefined

export function hasActiveCompanyAdvertisingSubscription(
  subscription: CompanySubscriptionStateLike,
): boolean {
  return subscription?.status === 'ACTIVE' && subscription?.isActive === true
}
