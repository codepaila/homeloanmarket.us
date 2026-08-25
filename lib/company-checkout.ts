// lib/company-checkout.ts
//
// Deterministic, content-addressed idempotency key for the Company Advertising
// Stripe Checkout session. The key includes a fingerprint of every material
// checkout parameter so that:
//   - identical logical requests reuse the SAME key  -> duplicate prevention,
//   - any materially different request (config change, coupon, plan, payment
//     configuration) produces a DIFFERENT key       -> Stripe never rejects a
//     legitimately changed request with a stale cached idempotency result.
// A prior canceled/expired session id rotates the key again so a retry after
// cancellation creates a fresh Checkout Session instead of replaying the old one.
import crypto from 'crypto'

export type CompanyCheckoutKeyInput = {
  companyId: string
  customerId: string
  priceId: string
  planId: string
  planName: string
  mode: string
  allowPromotionCodes: boolean
  managedPaymentsEnabled: boolean
  couponId: string | null
  billingAddressCollection: string
  /** When a prior (non-open) checkout exists for this company+plan, its id is
   *  appended so a retry after cancellation rotates the key. */
  priorSessionId?: string | null
}

// Fingerprint of the material checkout parameters. Kept canonical so the same
// request always hashes identically across processes. No sensitive values
// (secrets, tokens) are included.
function checkoutConfigFingerprint(input: Omit<CompanyCheckoutKeyInput, 'companyId' | 'customerId' | 'priceId' | 'priorSessionId'>): string {
  const canonical = JSON.stringify({
    mode: input.mode,
    allowPromotionCodes: input.allowPromotionCodes,
    managedPaymentsEnabled: input.managedPaymentsEnabled,
    couponId: input.couponId,
    billingAddressCollection: input.billingAddressCollection,
    planId: input.planId,
    planName: input.planName,
  })
  return crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 16)
}

export function buildCompanyCheckoutIdempotencyKey(input: CompanyCheckoutKeyInput): string {
  const fingerprint = checkoutConfigFingerprint(input)
  const base = `company_checkout_${fingerprint}_${input.companyId}_${input.customerId}_${input.priceId}`
  return input.priorSessionId ? `${base}_after_${input.priorSessionId}` : base
}