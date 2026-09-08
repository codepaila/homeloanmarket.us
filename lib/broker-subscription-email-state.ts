// lib/broker-subscription-email-state.ts
//
// Pure helpers for the broker subscription purchase email durable state
// machine. Kept free of any email/DB import so they are unit-testable without
// instantiating the email provider or connecting to the database.

import type { Prisma } from '@prisma/client'

export const CLAIM_LEASE_MS = 5 * 60 * 1000

// A row may be claimed when it is PENDING or FAILED (retryable), or PROCESSING
// with an expired lease (stale-claim recovery). A SENT row is never eligible.
export function isClaimEligible(status: string | null | undefined, leaseExpiresAt: Date | null | undefined, now: Date): boolean {
  if (status === 'SENT') return false
  if (status === 'PENDING' || status === 'FAILED') return true
  if (status === 'PROCESSING' && leaseExpiresAt && leaseExpiresAt <= now) return true
  return false
}

// Prisma `where` for the atomic claim update (kept in sync with isClaimEligible).
export function claimEligibleWhere(idempotencyKey: string, now: Date): Prisma.BrokerSubscriptionEmailLogWhereInput {
  return {
    idempotencyKey,
    OR: [
      { status: { in: ['PENDING', 'FAILED'] } },
      { status: 'PROCESSING', leaseExpiresAt: { lte: now } },
    ],
  }
}