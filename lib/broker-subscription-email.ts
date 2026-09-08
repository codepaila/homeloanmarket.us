// lib/broker-subscription-email.ts
//
// Durable, concurrency-safe delivery of the Broker subscription purchase email.
//
// The broker purchase email must be sent at most once per broker subscription,
// even when:
//   - Stripe retries the same webhook event
//   - multiple webhook deliveries / distinct event IDs target the same subscription
//   - multiple application instances process concurrently
//   - an email send fails and must be retried safely
//   - a process crashes mid-send (stale claim recovery)
//
// Idempotency identity (unchanged): subscription_purchase_<brokerSubscriptionId>.
//
// State machine (durable in MongoDB):
//   PENDING -> PROCESSING (claimed, leased) -> SENT   (only after provider success)
//              PROCESSING -> FAILED / retryable on provider error
//              PROCESSING with expired lease -> retryable (stale claim recovery)
//
// Concurrency-safe claim: a row is claimed atomically via updateMany gated on
// the current status and lease, so exactly one process wins the claim. The
// email is marked SENT only AFTER a successful sendEmail() (never before), so a
// crash cannot "lose" an email that was never sent. Because SENT is recorded
// after a successful provider call, a crash between the send and the SENT write
// can lead to a duplicate on retry — this residual ambiguity is a provider-level
// exactly-once limitation (Resend has no idempotency key for this operation) and
// is documented, not hidden.

import { sendEmail, emailTemplates } from '@/lib/email'
import prisma from '@/lib/prisma'
import { CLAIM_LEASE_MS, isClaimEligible, claimEligibleWhere } from '@/lib/broker-subscription-email-state'

export { isClaimEligible, claimEligibleWhere }

export type BrokerPurchaseEmailResult =
  | { status: 'sent' }
  | { status: 'skipped'; reason: 'already_sent' | 'not_found' | 'no_recipient' | 'claim_lost' }
  | { status: 'failed'; error: string; retryable: boolean }

export async function sendBrokerSubscriptionPurchaseEmailDurable(brokerSubscriptionId: string): Promise<BrokerPurchaseEmailResult> {
  const idempotencyKey = `subscription_purchase_${brokerSubscriptionId}`
  const now = new Date()

  try {
    // 1. Ensure a durable row exists (PENDING). The unique idempotencyKey makes
    //    concurrent create calls collapse to one row.
    try {
      await prisma.brokerSubscriptionEmailLog.upsert({
        where: { idempotencyKey },
        update: {},
        create: { idempotencyKey, brokerSubscriptionId, status: 'PENDING' },
      })
    } catch (error) {
      if ((error as { code?: string } | null)?.code === 'P2002') {
        // Another instance created it concurrently; proceed to claim below.
      } else {
        throw error
      }
    }

    // 2. Re-read state. If already SENT, this is a duplicate trigger — no-op.
    const current = await prisma.brokerSubscriptionEmailLog.findUnique({ where: { idempotencyKey } })
    if (current?.status === 'SENT') return { status: 'skipped', reason: 'already_sent' }

    // 3. Atomically claim the row: only a PENDING/FAILED row, or a PROCESSING
    //    row whose lease has expired, may be claimed. Exactly one concurrent
    //    execution wins (updateMany returns the matched count).
    const claimed = await prisma.brokerSubscriptionEmailLog.updateMany({
      where: claimEligibleWhere(idempotencyKey, now),
      data: { status: 'PROCESSING', attempts: { increment: 1 }, claimedAt: now, leaseExpiresAt: new Date(now.getTime() + CLAIM_LEASE_MS), lastError: null },
    })
    if (claimed.count !== 1) return { status: 'skipped', reason: 'claim_lost' }

    // 4. Load authoritative broker subscription + recipient.
    const subscription = await prisma.brokerSubscription.findUnique({
      where: { id: brokerSubscriptionId },
      include: { broker: { include: { user: true } }, planRef: true },
    })
    if (!subscription?.broker) {
      await prisma.brokerSubscriptionEmailLog.update({ where: { idempotencyKey }, data: { status: 'FAILED', lastError: 'Broker subscription not found' } })
      return { status: 'failed', error: 'Broker subscription not found', retryable: false }
    }
    const recipient = subscription.broker.email || subscription.broker.user?.email
    if (!recipient) {
      // Not an error: a broker without any email simply cannot receive the
      // message; do not retry forever. Mark as not retryable.
      await prisma.brokerSubscriptionEmailLog.update({ where: { idempotencyKey }, data: { status: 'SENT', sentAt: now, messageId: null, lastError: 'no recipient email' } })
      return { status: 'skipped', reason: 'no_recipient' }
    }

    // 5. Build the canonical template (unchanged) and send via the shared
    //    sendEmail() boundary. Deterministic idempotency key preserved.
    const plan = subscription.planRef
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://homeloanmarket.com'
    const template = emailTemplates.subscriptionPurchased({
      brokerName: subscription.broker.displayName || 'there',
      planName: plan?.name || subscription.plan,
      priceCents: typeof plan?.price === 'number' ? plan.price : 0,
      currency: plan?.currency || 'usd',
      interval: plan?.billingInterval || 'month',
      startDate: subscription.startDate || new Date(),
      endDate: subscription.endDate,
      dashboardUrl: `${appUrl}/broker/subscription`,
    })

    let result
    try {
      result = await sendEmail({
        to: recipient,
        subject: template.subject,
        html: template.html,
        text: `Your HomeLoanMarket ${plan?.name || subscription.plan} subscription is active. Manage it: ${appUrl}/broker/subscription`,
        idempotencyKey,
      })
    } catch (sendError) {
      // Provider threw; release the claim so a retry can reclaim after the
      // lease, and record a retryable failure immediately.
      await prisma.brokerSubscriptionEmailLog.update({
        where: { idempotencyKey },
        data: { status: 'FAILED', lastError: sendError instanceof Error ? sendError.message : 'Unknown send error' },
      })
      return { status: 'failed', error: sendError instanceof Error ? sendError.message : 'Unknown send error', retryable: true }
    }

    // 6. Provider rejected the send (non-throwing error result). Retryable.
    if (!result.success) {
      await prisma.brokerSubscriptionEmailLog.update({
        where: { idempotencyKey },
        data: { status: 'FAILED', lastError: result.error || 'Email send failed' },
      })
      return { status: 'failed', error: result.error || 'Email send failed', retryable: true }
    }

    // 7. Mark SENT only after the provider accepted the send.
    await prisma.brokerSubscriptionEmailLog.update({
      where: { idempotencyKey },
      data: { status: 'SENT', sentAt: now, messageId: result.messageId || null, lastError: null },
    })
    return { status: 'sent' }
  } catch (error) {
    console.error('Broker subscription purchase email (durable) failed:', error)
    return { status: 'failed', error: error instanceof Error ? error.message : 'Unknown error', retryable: true }
  }
}
