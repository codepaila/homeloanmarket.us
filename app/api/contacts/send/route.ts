// app/api/contacts/send/route.ts
//
// Public, anonymous broker contact endpoint. The canonical broker contact
// validation + abuse controls live here so the server — never the React form —
// is authoritative. Reuses the existing shared email provider/templates and the
// distributed Upstash limiters; no new contact system is introduced.
import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import prisma from '@/lib/prisma'
import { sendEmail, emailTemplates, htmlToText, isValidEmail } from '@/lib/email'
import { isPublicBroker } from '@/lib/broker-policy'
import { contactBrokerRateLimit, contactBrokerTargetRateLimit } from '@/lib/rateLimit'
import { getClientIP } from '@/lib/advertisements/utils'

// Server-authoritative bounds. These mirror the canonical public site contact
// bounds (lib/contact-submission.ts) so every public contact surface enforces
// the same limits. Oversized input is rejected, never silently truncated.
export const BROKER_CONTACT_NAME_MIN = 2
export const BROKER_CONTACT_NAME_MAX = 100
export const BROKER_CONTACT_EMAIL_MAX = 254
export const BROKER_CONTACT_PHONE_MIN_DIGITS = 7
export const BROKER_CONTACT_PHONE_MAX_DIGITS = 20
export const BROKER_CONTACT_SUBJECT_MAX = 200
export const BROKER_CONTACT_MESSAGE_MAX = 5000
export const BROKER_CONTACT_METADATA_MAX = 100
export const BROKER_CONTACT_LOAN_AMOUNT_MAX = 1_000_000_000_000

export const CONTACT_RATE_LIMIT_MESSAGE = 'Too many contact attempts. Please try again later.'
export const FRIENDLY_CONTACT_ERROR = 'Failed to send message. Please try again.'
export const FRIENDLY_DELIVERY_ERROR = 'We couldn\u2019t deliver your message right now. Please try again.'

const CONTACT_TYPES = new Set(['email', 'phone', 'whatsapp', 'sms'])
const TIMELINES = new Set(['immediate', '1-3_months', '3-6_months', 'exploring'])
const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/

export type BrokerContactSubmission = {
  brokerId: string
  brokerSlug: string
  name: string
  email: string
  phone: string
  subject: string
  message: string
  contactType: string
  city: string
  propertyType: string
  loanType: string
  timeline: string
  loanAmount: number | null
  agreeToMarketing: boolean
  agreeToTerms: boolean
}

// Normalizes arbitrary request JSON (trim -> lowercase email, numeric loan
// amount) without throwing on malformed input. The client never controls any
// recipient: broker/admin addresses are resolved server-side after validation.
export function parseBrokerContactSubmission(body: unknown): BrokerContactSubmission {
  const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const asString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

  let loanAmount: number | null = null
  const rawLoanAmount = record.loanAmount
  if (typeof rawLoanAmount === 'number' && Number.isFinite(rawLoanAmount)) {
    loanAmount = rawLoanAmount
  } else if (typeof rawLoanAmount === 'string' && rawLoanAmount.trim() !== '') {
    const parsed = Number(rawLoanAmount)
    loanAmount = Number.isFinite(parsed) ? parsed : Number.NaN
  }

  return {
    brokerId: asString(record.brokerId),
    brokerSlug: asString(record.brokerSlug),
    name: asString(record.name),
    email: asString(record.email).toLowerCase(),
    phone: asString(record.phone),
    subject: asString(record.subject),
    message: asString(record.message),
    contactType: asString(record.contactType) || 'email',
    city: asString(record.city),
    propertyType: asString(record.propertyType),
    loanType: asString(record.loanType),
    timeline: asString(record.timeline) || 'exploring',
    loanAmount,
    agreeToMarketing: record.agreeToMarketing === true,
    agreeToTerms: record.agreeToTerms === true,
  }
}

// Returns a friendly field-specific error or null when the payload is valid.
export function validateBrokerContactSubmission(input: BrokerContactSubmission): string | null {
  if (input.name.length < BROKER_CONTACT_NAME_MIN || input.name.length > BROKER_CONTACT_NAME_MAX) {
    return `Please enter a name between ${BROKER_CONTACT_NAME_MIN} and ${BROKER_CONTACT_NAME_MAX} characters.`
  }
  if (!input.email || input.email.length > BROKER_CONTACT_EMAIL_MAX || !isValidEmail(input.email)) {
    return 'Please enter a valid email address.'
  }
  const phoneDigits = input.phone.replace(/\D/g, '')
  if (phoneDigits.length < BROKER_CONTACT_PHONE_MIN_DIGITS || phoneDigits.length > BROKER_CONTACT_PHONE_MAX_DIGITS) {
    return 'Please enter a valid phone number.'
  }
  if (input.subject && input.subject.length > BROKER_CONTACT_SUBJECT_MAX) {
    return `Subject must be ${BROKER_CONTACT_SUBJECT_MAX} characters or fewer.`
  }
  if (!input.message) {
    return 'Please enter a message.'
  }
  if (input.message.length > BROKER_CONTACT_MESSAGE_MAX) {
    return `Message must be ${BROKER_CONTACT_MESSAGE_MAX} characters or fewer.`
  }
  if (!CONTACT_TYPES.has(input.contactType)) {
    return 'Please select a valid contact method.'
  }
  if (!TIMELINES.has(input.timeline)) {
    return 'Please select a valid timeline.'
  }
  if (input.city.length > BROKER_CONTACT_METADATA_MAX) {
    return `City must be ${BROKER_CONTACT_METADATA_MAX} characters or fewer.`
  }
  if (input.propertyType.length > BROKER_CONTACT_METADATA_MAX) {
    return `Property type must be ${BROKER_CONTACT_METADATA_MAX} characters or fewer.`
  }
  if (input.loanType.length > BROKER_CONTACT_METADATA_MAX) {
    return `Loan type must be ${BROKER_CONTACT_METADATA_MAX} characters or fewer.`
  }
  if (
    input.loanAmount !== null
    && (!Number.isFinite(input.loanAmount) || input.loanAmount < 0 || input.loanAmount > BROKER_CONTACT_LOAN_AMOUNT_MAX)
  ) {
    return 'Please enter a valid loan amount.'
  }
  if (!input.agreeToTerms) {
    return 'Please agree to the terms before sending.'
  }
  return null
}

// Deterministic, bounded fingerprint used only to build the existing
// sendEmail() in-memory idempotency keys, so a repeated identical submission
// inside the provider dedupe window does not double-send. NOT durable storage:
// a process restart can allow a replayed submission to send again.
function submissionFingerprint(brokerId: string, input: BrokerContactSubmission): string {
  return createHash('sha256')
    .update(`${brokerId}\u0000${input.email}\u0000${input.subject}\u0000${input.message}`)
    .digest('hex')
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const input = parseBrokerContactSubmission(body)

    // Validation happens before any database work or external call. Invalid
    // submissions never create a contact message or send an email.
    const validationError = validateBrokerContactSubmission(input)
    if (validationError) {
      return NextResponse.json({ success: false, error: validationError }, { status: 400 })
    }

    // Distributed abuse controls (existing Upstash infrastructure). IP + email
    // before any database lookup; the broker-target guard runs after the
    // (required) broker resolution. Failures here create no records.
    const ip = getClientIP(request.headers)
    const ipLimit = await contactBrokerRateLimit.limit(`contact:${ip}`)
    if (!ipLimit.success) {
      return NextResponse.json({ success: false, error: CONTACT_RATE_LIMIT_MESSAGE }, { status: 429 })
    }
    const emailLimit = await contactBrokerRateLimit.limit(`contact-email:${input.email}`)
    if (!emailLimit.success) {
      return NextResponse.json({ success: false, error: CONTACT_RATE_LIMIT_MESSAGE }, { status: 429 })
    }

    // The public broker profile only exposes the canonical profileSlug, never
    // the internal document id. Resolve by slug (unique) with an id fallback,
    // but reject malformed ids up front so an attacker cannot force a
    // database-level ObjectId error / unnecessary work.
    if (!input.brokerSlug && !input.brokerId) {
      return NextResponse.json(
        { success: false, error: 'Broker identifier is required' },
        { status: 400 },
      )
    }
    if (!input.brokerSlug && !OBJECT_ID_RE.test(input.brokerId)) {
      return NextResponse.json({ success: false, error: 'Broker not found' }, { status: 404 })
    }

    const broker = await prisma.broker.findUnique({
      where: input.brokerSlug ? { profileSlug: input.brokerSlug } : { id: input.brokerId },
      include: {
        user: { select: { email: true, isActive: true } },
      },
    })

    if (!broker || !isPublicBroker({
      isVisible: broker.isVisible,
      verificationStatus: broker.verificationStatus,
      brokerStatus: broker.brokerStatus,
      creationSource: broker.creationSource,
      userId: broker.userId,
      userIsActive: broker.user?.isActive,
    })) {
      return NextResponse.json({ success: false, error: 'Broker not found' }, { status: 404 })
    }

    const brokerLimit = await contactBrokerTargetRateLimit.limit(`contact-broker:${broker.id}`)
    if (!brokerLimit.success) {
      return NextResponse.json({ success: false, error: CONTACT_RATE_LIMIT_MESSAGE }, { status: 429 })
    }

    // Create the contact message against the resolved broker. All stored fields
    // are the validated, bounded values.
    const contactMessage = await prisma.contactMessage.create({
      data: {
        brokerId: broker.id,
        name: input.name,
        email: input.email,
        phone: input.phone,
        subject: input.subject || `Inquiry from ${input.name}`,
        message: input.message,
        contactType: input.contactType,
        propertyType: input.propertyType || null,
        loanType: input.loanType || null,
        loanAmount: input.loanAmount,
        timeline: input.timeline,
        agreeToMarketing: input.agreeToMarketing,
        agreeToTerms: input.agreeToTerms,
        city: input.city || 'Not specified',
      },
    })

    // Update broker's contact message count
    await prisma.broker.update({
      where: { id: broker.id },
      data: {
        totalLeads: { increment: 1 },
      },
    })

    const fingerprint = submissionFingerprint(broker.id, input)

    // Broker notification — recipient is ALWAYS the broker's server-stored
    // email (broker.email || owning user's email). The client can never supply
    // or override this recipient. Existing buyer -> broker contact flow.
    const brokerNotificationEmail = broker.email || broker.user?.email
    if (brokerNotificationEmail && isValidEmail(brokerNotificationEmail)) {
      try {
        const brokerTemplate = emailTemplates.newContactMessage({
          contactName: contactMessage.name,
          contactEmail: contactMessage.email || '',
          contactPhone: contactMessage.phone || '',
          contactMessage: contactMessage.message,
          loanType: contactMessage.loanType || '',
          propertyType: contactMessage.propertyType || '',
          loanAmount: contactMessage.loanAmount,
          receivedAt: contactMessage.createdAt,
          reviewUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://homeloanmarket.com'}/broker/contacts/${contactMessage.id}`,
        })
        const result = await sendEmail({
          to: brokerNotificationEmail,
          subject: brokerTemplate.subject,
          html: brokerTemplate.html,
          text: htmlToText(brokerTemplate.html),
          idempotencyKey: `broker_contact_notification_${fingerprint}`,
        })
        if (!result.success) {
          console.error('Failed to send broker notification email:', result.errorCode, result.error)
          return NextResponse.json({ success: false, error: FRIENDLY_DELIVERY_ERROR }, { status: 502 })
        }
      } catch (emailError) {
        console.error('Failed to send broker notification email:', emailError)
        return NextResponse.json({ success: false, error: FRIENDLY_DELIVERY_ERROR }, { status: 502 })
      }
    }

    // Customer confirmation — sent ONLY to the validated, normalized submitter
    // address. Its failure never fails an accepted submission (the lead is
    // already persisted and the broker already notified).
    if (isValidEmail(input.email)) {
      try {
        const customerTemplate = emailTemplates.contactMessageConfirmation({
          recipientName: input.name,
          brokerName: broker.displayName || 'the mortgage originator',
          companyName: broker.companyName,
          messageSubject: contactMessage.subject || '',
          sentAt: contactMessage.createdAt,
        })
        await sendEmail({
          to: input.email,
          subject: customerTemplate.subject,
          html: customerTemplate.html,
          text: htmlToText(customerTemplate.html),
          idempotencyKey: `broker_contact_confirmation_${fingerprint}`,
        })
      } catch (emailError) {
        console.error('Failed to send customer confirmation email:', emailError)
      }
    }

    // Public success response only. No internal message id, broker internals,
    // provider ids, or raw errors are returned to anonymous callers.
    return NextResponse.json({
      success: true,
      message: 'Your message has been sent successfully',
    })
  } catch (error) {
    console.error('Error sending contact message:', error)
    return NextResponse.json(
      { success: false, error: FRIENDLY_CONTACT_ERROR },
      { status: 500 },
    )
  }
}
