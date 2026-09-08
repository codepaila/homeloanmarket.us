import { sendEmail, emailTemplates } from '@/lib/email'

// Shared broker-verification transition helpers used by both admin broker PATCH
// routes. They centralize:
//   - verifiedAt timestamp semantics (set-if-null on VERIFIED, clear on
//     explicit UNVERIFIED, preserved on unrelated saves),
//   - the UNVERIFIED → VERIFIED transition detection (drives the email),
//   - the fire-and-forget "broker account verified" email.
//
// Verification is ADMIN-only (enforced by the routes); isVisible is NEVER
// modified here — verification and visibility are independent concepts.

export type BrokerVerificationState = {
  verificationStatus?: string | null
  verifiedAt?: Date | null
}

// Compute the verification write for an admin verification change. Preserves an
// existing verifiedAt on repeated VERIFIED saves; clears it only when a broker
// is explicitly set back to UNVERIFIED. Never touches isVisible.
export function buildVerificationUpdate(
  current: BrokerVerificationState,
  target: string,
): { verificationStatus: 'VERIFIED' | 'UNVERIFIED'; verifiedAt: Date | null } {
  if (target === 'VERIFIED') {
    return { verificationStatus: 'VERIFIED', verifiedAt: current.verifiedAt ?? new Date() }
  }
  return { verificationStatus: 'UNVERIFIED', verifiedAt: null }
}

// True only on the actual UNVERIFIED (or null) → VERIFIED transition. A repeated
// save of an already-VERIFIED broker returns false so no duplicate email fires.
export function wasVerifiedTransition(
  currentStatus: string | null | undefined,
  target: string,
): boolean {
  return currentStatus !== 'VERIFIED' && target === 'VERIFIED'
}

// "Your HomeLoanMarket broker account is verified" email. Fire-and-forget: an
// email failure is logged but never rolls back the already-persisted DB verification
// (the DB remains authoritative). Idempotency is scoped per broker
// (deterministic profileSlug key) so a repeated transition cannot send
// duplicate emails.
export async function sendBrokerVerifiedEmail(params: {
  to: string
  displayName: string
  profileSlug: string
  city?: string | null
  experienceYears?: number | null
}) {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://homeloanmarket.com'
    const template = emailTemplates.brokerVerified({
      displayName: params.displayName,
      profileUrl: `${appUrl}/brokers/${params.profileSlug}`,
      dashboardUrl: `${appUrl}/broker/dashboard`,
      city: params.city,
      experienceYears: params.experienceYears,
    })
    await sendEmail({
      to: params.to,
      subject: template.subject,
      html: template.html,
      text: `Your HomeLoanMarket broker account is verified. Go to your dashboard: ${appUrl}/broker/dashboard`,
      idempotencyKey: `broker_verified_${params.profileSlug}`,
    })
  } catch (error) {
    console.error('Failed to send broker verification email (verification already persisted):', error)
  }
}