// Canonical broker-facing plan display names.
//
// Every broker surface (dashboard header badge, broker dashboard, broker
// profile, subscription management) derives its plan label from the same
// authoritative broker subscription plan code through this single mapping.
// This keeps every surface in agreement about what the current plan is.
export function brokerPlanDisplayName(planCode: string | null | undefined): string {
  switch (planCode) {
    case 'FEATURED':
      return 'Mortgage Expert'
    case 'FREE':
      return 'Free'
    default:
      return planCode && planCode.length > 0 ? planCode : 'Free'
  }
}

// True when the effective plan is a paid entitlement. Derived from the
// canonical plan code so no surface maintains its own paid-plan list.
export function isPaidBrokerPlan(planCode: string | null | undefined): boolean {
  return planCode === 'FEATURED'
}