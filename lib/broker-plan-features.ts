// Client-safe feature metadata for broker subscription plans.
// This module must never import server-only dependencies (prisma, stripe) so it
// can be used from client components. The canonical feature codes still live in
// lib/broker-plans.ts (server); this is the single presentation mapping for the
// admin plan editors and is never used for entitlement checks.
export type BrokerPlanFeatureDef = {
  code: string
  label: string
  description: string
}

export const BROKER_FEATURE_DEFS: readonly BrokerPlanFeatureDef[] = [
  {
    code: 'PROFILE_BADGE',
    label: 'Profile Badge (Mortgage Expert)',
    description:
      'Grants the Mortgage Expert qualification badge on the public profile and listings. This is a plan entitlement badge — it is not a review or customer rating.',
  },
  {
    code: 'SUPPORT_TICKETS',
    label: 'Priority Support Tickets',
    description: 'Grants access to the priority support ticket queue.',
  },
] as const

export const BROKER_FEATURE_DEFS_BY_CODE: ReadonlyMap<string, BrokerPlanFeatureDef> = new Map(
  BROKER_FEATURE_DEFS.map((def) => [def.code, def]),
)