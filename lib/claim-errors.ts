// Human-readable admin messages for claim invitation operation results.
// Internal codes are never surfaced directly to administrators.
export const CLAIM_INVITATION_ERROR_MESSAGES: Record<string, string> = {
  INVALID_EMAIL: 'Recipient email address is invalid.',
  RATE_LIMITED: 'This recipient has reached the invitation limit. Try again later.',
  ALREADY_INVITED: 'An active invitation already exists.',
  ALREADY_CLAIMED: 'This broker has already been claimed.',
  BROKER_NOT_FOUND: 'Broker not found.',
  NOT_FOUND: 'Broker not found.',
  INELIGIBLE: 'This broker is not eligible for an invitation.',
  EXPIRED: 'The previous invitation has expired.',
  REVOKED: 'The previous invitation was revoked.',
  EMAIL_DELIVERY_FAILED: 'The invitation email could not be sent.',
  LOCKED: 'The broker is busy. Try again in a moment.',
  COMPLETED: 'This broker has already been claimed.',
  UNEXPECTED_ERROR: 'Something went wrong. Please try again.',
}

export function friendlyClaimErrorMessage(code?: string | null) {
  if (!code) return 'Invitation could not be sent.'
  return CLAIM_INVITATION_ERROR_MESSAGES[code] || 'Something went wrong. Please try again.'
}
