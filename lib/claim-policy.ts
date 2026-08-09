export function isClaimInvitationActive(
  invitation: { status: 'ACTIVE' | 'USED' | 'EXPIRED' | 'REVOKED'; expiresAt: Date },
  now = new Date(),
) {
  return invitation.status === 'ACTIVE' && invitation.expiresAt > now
}

// Recipient binding: a claim invitation issued to `recipientEmail` may only be
// completed by an account whose email matches that intended recipient. This is
// the canonical server-side rule; the raw claim link is a bearer credential and
// must never transfer ownership to a different account.
export function isClaimRecipientMatch(
  recipientEmail: string | null | undefined,
  claimantEmail: string | null | undefined,
): boolean {
  if (!recipientEmail || !claimantEmail) return false
  return recipientEmail.trim().toLowerCase() === claimantEmail.trim().toLowerCase()
}
