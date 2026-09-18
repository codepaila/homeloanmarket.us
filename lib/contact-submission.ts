import { createHash } from 'node:crypto'
import { sendEmail, emailTemplates, isValidEmail } from '@/lib/email'
import { platformConfig } from '@/lib/platform-config'

// Server-authoritative bounds for the public site contact form. They mirror
// the client-side rules so the UI can fail fast, while the server remains the
// single source of truth for what is accepted.
export const CONTACT_NAME_MIN = 2
export const CONTACT_NAME_MAX = 100
export const CONTACT_EMAIL_MAX = 254
export const CONTACT_SUBJECT_MAX = 200
export const CONTACT_MESSAGE_MIN = 10
export const CONTACT_MESSAGE_MAX = 5000

export const CONTACT_RATE_LIMIT_MESSAGE = 'Too many requests. Please try again later.'
export const FRIENDLY_CONTACT_ERROR = 'We couldn\u2019t send your message right now. Please try again.'

export type ContactSubmission = {
  name: string
  email: string
  phone: string
  subject: string
  message: string
}

export type ContactDeliveryResult =
  | { success: true; message: string; confirmationSent: boolean }
  | { success: false; status: number; error: string }

// Internal per-attempt outcome. Admin delivery is essential (it is the record
// of the submission); the submitter confirmation is a courtesy side effect.
type DeliveryAttempt =
  | { ok: true; message: string }
  | { ok: false; status: number; error: string }

// Normalizes arbitrary request JSON into the canonical contact payload
// (trim -> lowercase email), without throwing on malformed input.
export function parseContactSubmission(body: unknown): ContactSubmission {
  const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const asString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')
  return {
    name: asString(record.name),
    email: asString(record.email).toLowerCase(),
    phone: asString(record.phone),
    subject: asString(record.subject),
    message: asString(record.message),
  }
}

// Returns a friendly, field-specific error or null when the payload is valid.
export function validateContactSubmission(input: ContactSubmission): string | null {
  if (input.name.length < CONTACT_NAME_MIN || input.name.length > CONTACT_NAME_MAX) {
    return `Please enter a name between ${CONTACT_NAME_MIN} and ${CONTACT_NAME_MAX} characters.`
  }
  if (!input.email || input.email.length > CONTACT_EMAIL_MAX || !isValidEmail(input.email)) {
    return 'Please enter a valid email address.'
  }
  const phoneDigits = input.phone.replace(/\D/g, '')
  if (!phoneDigits || !(phoneDigits.length === 10 || (phoneDigits.length === 11 && phoneDigits.startsWith('1')))) {
    return 'Please enter a valid US phone number.'
  }
  if (!input.subject || input.subject.length > CONTACT_SUBJECT_MAX) {
    return input.subject ? `Subject must be ${CONTACT_SUBJECT_MAX} characters or fewer.` : 'Please enter a subject.'
  }
  if (input.message.length < CONTACT_MESSAGE_MIN) {
    return 'Please enter a message.'
  }
  if (input.message.length > CONTACT_MESSAGE_MAX) {
    return `Message must be ${CONTACT_MESSAGE_MAX} characters or fewer.`
  }
  return null
}

// Deterministic, bounded fingerprint of the submission content. Used only to
// build the existing sendEmail() in-memory idempotency keys so a repeated
// identical submission inside the dedupe window does not double-send. This is
// NOT durable storage: if the process restarts, a replayed submission can send
// again. The public contact endpoint intentionally does not persist submissions
// (no new DB model is introduced for this).
function submissionFingerprint(input: ContactSubmission): string {
  return createHash('sha256')
    .update(`${input.email}\u0000${input.subject}\u0000${input.message}`)
    .digest('hex')
}

// ADMIN notification — essential delivery. Goes to every configured admin via
// the canonical recipient source and the existing generic notification
// template. Never leak provider/config details to the caller.
async function sendAdminContactNotification(
  input: ContactSubmission,
  fingerprint: string,
): Promise<DeliveryAttempt> {
  if (platformConfig.adminEmails.length === 0) {
    console.error('Site contact form failed: no admin recipients configured (ADMIN_EMAILS).')
    return { ok: false, status: 503, error: FRIENDLY_CONTACT_ERROR }
  }

  const template = emailTemplates.notification({
    title: `New platform contact message: ${input.subject}`,
    message: 'A visitor submitted the platform contact form.',
    info: {
      Name: input.name,
      Email: input.email,
      Phone: input.phone,
      Subject: input.subject,
      Message: input.message,
    },
  })
  const result = await sendEmail({
    to: platformConfig.adminEmails,
    subject: template.subject,
    html: template.html,
    text: `From: ${input.name} (${input.email})\nPhone: ${input.phone}\n\n${input.message}`,
    replyTo: input.email,
    idempotencyKey: `site_contact_admin_${fingerprint}`,
  })

  if (!result.success) {
    console.error('Site contact form admin email failed:', result.errorCode, result.error)
    return { ok: false, status: 502, error: FRIENDLY_CONTACT_ERROR }
  }

  return { ok: true, message: 'Message sent successfully.' }
}

// SUBMITTER confirmation — courtesy side effect. Sent to the normalized
// submitted address only, after validation, using the same branded shell and
// generic notification template. Uses a non-admin reply-to so internal admin
// addresses are never exposed, and carries no internal IDs.
async function sendSubmitterContactConfirmation(
  input: ContactSubmission,
  fingerprint: string,
): Promise<boolean> {
  if (!isValidEmail(input.email)) return false

  const replyTo =
    platformConfig.supportEmail ||
    platformConfig.emailReplyTo ||
    platformConfig.emailFrom ||
    undefined

  const template = emailTemplates.notification({
    title: 'We received your message',
    message: `Thank you for contacting HomeLoanMarket, ${input.name}. Our team has received your message and will review it.`,
    info: {
      Subject: input.subject,
      'Received At': new Date().toLocaleString(),
    },
  })

  try {
    const result = await sendEmail({
      to: input.email,
      subject: template.subject,
      html: template.html,
      text: `Hi ${input.name},\n\nThank you for contacting HomeLoanMarket. We have received your message and will review it.`,
      replyTo,
      idempotencyKey: `site_contact_confirmation_${fingerprint}`,
    })
    if (!result.success) {
      console.error('Site contact confirmation email failed:', result.errorCode, result.error)
      return false
    }
    return true
  } catch (error) {
    console.error('Site contact confirmation email threw:', error)
    return false
  }
}

// Orchestrates both business requirements with independent delivery attempts:
//   1. Admin notification must succeed, otherwise the submission is reported as
//      failed (email is the only record; nothing is persisted).
//   2. The submitter confirmation is attempted only after admin delivery and its
//      failure never fails a valid submission.
export async function deliverContactSubmission(input: ContactSubmission): Promise<ContactDeliveryResult> {
  const fingerprint = submissionFingerprint(input)

  const admin = await sendAdminContactNotification(input, fingerprint)
  if (!admin.ok) {
    return { success: false, status: admin.status, error: admin.error }
  }

  const confirmationSent = await sendSubmitterContactConfirmation(input, fingerprint)
  return { success: true, message: admin.message, confirmationSent }
}
