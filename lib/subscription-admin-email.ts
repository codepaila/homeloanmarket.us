// lib/subscription-admin-email.ts
//
// Admin subscription-payment notification for BOTH products (Company
// advertising and Broker Mortgage Expert/FEATURED).
//
// This is intentionally a thin, non-durable dispatch: it is invoked ONLY from
// inside the existing durable subscription-email senders
// (lib/company-subscription-email.ts / lib/broker-subscription-email.ts), whose
// durable claim (PENDING -> PROCESSING -> SENT per Stripe subscription) is the
// authoritative idempotency gate. That guarantees at most one admin
// notification per Stripe subscription activation without introducing a second
// durable log or a new email architecture. The deterministic `sendEmail`
// idempotency key is a secondary guard only.
//
// Recipients: the canonical runtime source is `platformConfig.adminEmails`
// (parsed once from ADMIN_EMAILS / legacy ADMIN_EMAIL). When no admin is
// configured the notification is skipped — never thrown — so billing and the
// customer email are unaffected.
import { sendEmail, emailTemplates } from '@/lib/email'
import { platformConfig } from '@/lib/platform-config'
import { formatPlanPriceAndInterval } from '@/lib/email-format'

export type SubscriptionAdminPaymentProduct = 'COMPANY_ADVERTISING' | 'BROKER_FEATURED'

export type SubscriptionAdminPaymentNotificationInput = {
  product: SubscriptionAdminPaymentProduct
  // Local subscription identity (CompanySubscription.id / BrokerSubscription.id).
  localSubscriptionId: string
  // Authoritative Stripe subscription identity.
  stripeSubscriptionId: string
  planName: string
  priceCents: number
  currency?: string | null
  interval?: string | null
  // Human display name for the paying account (company name / broker name).
  customerName: string
  customerEmail?: string | null
  activatedAt?: Date
}

export type SubscriptionAdminPaymentNotificationResult =
  | { status: 'sent' }
  | { status: 'skipped'; reason: 'no_admin_recipients' }
  | { status: 'failed'; error: string }

// Customer-/admin-facing label. Admin context may use internal "broker"
// terminology, but the product label distinguishes the two products clearly.
function productLabel(product: SubscriptionAdminPaymentProduct): string {
  return product === 'COMPANY_ADVERTISING' ? 'Company advertising' : 'Broker FEATURED (Mortgage Expert)'
}

export async function sendSubscriptionAdminPaymentNotification(
  input: SubscriptionAdminPaymentNotificationInput,
): Promise<SubscriptionAdminPaymentNotificationResult> {
  try {
    if (platformConfig.adminEmails.length === 0) {
      console.warn('No admin email recipients configured; skipping subscription payment notification', {
        product: input.product,
        localSubscriptionId: input.localSubscriptionId,
      })
      return { status: 'skipped', reason: 'no_admin_recipients' }
    }

    const label = productLabel(input.product)
    const amount = formatPlanPriceAndInterval(input.priceCents, input.currency || 'usd', input.interval || 'month')
    const activatedAt = input.activatedAt || new Date()
    const accountLabel = input.product === 'COMPANY_ADVERTISING' ? 'Company' : 'Mortgage Originator'

    const template = emailTemplates.notification({
      title: `${label} subscription payment received: ${input.customerName}`,
      message: `A ${label} subscription payment was received and the subscription is now active.`,
      info: {
        Product: label,
        Plan: input.planName,
        Amount: amount,
        [accountLabel]: input.customerName,
        ...(input.customerEmail ? { 'Billing Email': input.customerEmail } : {}),
        Status: 'Active',
        Activated: activatedAt.toLocaleString('en-US'),
      },
    })

    // Deterministic secondary idempotency key (product + local subscription +
    // Stripe subscription). The durable customer-email claim is the primary
    // gate; this keeps replays of the SAME send collapsed even within a single
    // process window.
    const idempotencyKey = `admin_subscription_payment_${input.product}_${input.localSubscriptionId}_${input.stripeSubscriptionId}`

    const result = await sendEmail({
      to: platformConfig.adminEmails,
      subject: template.subject,
      html: template.html,
      idempotencyKey,
    })

    if (!result.success) {
      console.error('Admin subscription payment notification failed', {
        product: input.product,
        localSubscriptionId: input.localSubscriptionId,
        error: result.error,
      })
      return { status: 'failed', error: result.error || 'Email send failed' }
    }

    return { status: 'sent' }
  } catch (error) {
    console.error('Admin subscription payment notification error', {
      product: input.product,
      localSubscriptionId: input.localSubscriptionId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return { status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
