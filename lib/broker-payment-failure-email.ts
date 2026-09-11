// lib/broker-payment-failure-email.ts
import { sendEmail, emailTemplates } from '@/lib/email'
import prisma from '@/lib/prisma'
import { platformConfig } from '@/lib/platform-config'
import type { BrokerSubscriptionPaymentFailureEmailStatus } from '@prisma/client'

const CLAIM_LEASE_MS = 5 * 60 * 1000

export type BrokerPaymentFailureEmailResult =
  | { status: 'sent' }
  | { status: 'skipped'; reason: 'already_sent' | 'not_found' | 'no_recipient' | 'claim_lost' }
  | { status: 'failed'; error: string; retryable: boolean }

export async function sendBrokerPaymentFailureEmailDurable(brokerSubscriptionId: string, invoiceId: string): Promise<BrokerPaymentFailureEmailResult> {
  const idempotencyKey = `payment_failure_broker_${brokerSubscriptionId}_${invoiceId}`
  const now = new Date()

  try {
    try {
      await prisma.brokerSubscriptionPaymentFailureLog.upsert({
        where: { idempotencyKey },
        update: {},
        create: { idempotencyKey, brokerSubscriptionId, invoiceId, status: 'PENDING' },
      })
    } catch (error) {
      if ((error as { code?: string } | null)?.code !== 'P2002') throw error
    }

    const current = await prisma.brokerSubscriptionPaymentFailureLog.findUnique({ where: { idempotencyKey } })
    if (current?.status === 'SENT') return { status: 'skipped', reason: 'already_sent' }

    const claimed = await prisma.brokerSubscriptionPaymentFailureLog.updateMany({
      where: {
        idempotencyKey,
        OR: [
          { status: { in: ['PENDING', 'FAILED'] as BrokerSubscriptionPaymentFailureEmailStatus[] } },
          { status: 'PROCESSING', leaseExpiresAt: { lte: now } },
        ],
      },
      data: { status: 'PROCESSING', attempts: { increment: 1 }, claimedAt: now, leaseExpiresAt: new Date(now.getTime() + CLAIM_LEASE_MS), lastError: null },
    })
    if (claimed.count !== 1) return { status: 'skipped', reason: 'claim_lost' }

    const subscription = await prisma.brokerSubscription.findUnique({
      where: { id: brokerSubscriptionId },
      include: { broker: { include: { user: true } } },
    })
    if (!subscription?.broker) {
      await prisma.brokerSubscriptionPaymentFailureLog.update({ where: { idempotencyKey }, data: { status: 'FAILED', lastError: 'Broker subscription not found' } })
      return { status: 'failed', error: 'Broker subscription not found', retryable: false }
    }
    const recipient = subscription.broker.email || subscription.broker.user?.email
    if (!recipient) {
      await prisma.brokerSubscriptionPaymentFailureLog.update({ where: { idempotencyKey }, data: { status: 'SENT', sentAt: now, messageId: null, lastError: 'no recipient email' } })
      return { status: 'skipped', reason: 'no_recipient' }
    }

    const template = emailTemplates.paymentFailure(
      subscription.broker.displayName || 'there',
      'Broker',
      `${platformConfig.appUrl}/broker/subscription/billing`,
    )

    let result
    try {
      result = await sendEmail({
        to: recipient,
        subject: template.subject,
        html: template.html,
        text: `Your HomeLoanMarket subscription payment failed. Please update your billing info: ${platformConfig.appUrl}/broker/subscription/billing`,
        idempotencyKey,
      })
    } catch (sendError) {
      await prisma.brokerSubscriptionPaymentFailureLog.update({
        where: { idempotencyKey },
        data: { status: 'FAILED', lastError: sendError instanceof Error ? sendError.message : 'Unknown send error' },
      })
      return { status: 'failed', error: sendError instanceof Error ? sendError.message : 'Unknown send error', retryable: true }
    }

    if (!result.success) {
      await prisma.brokerSubscriptionPaymentFailureLog.update({
        where: { idempotencyKey },
        data: { status: 'FAILED', lastError: result.error || 'Email send failed' },
      })
      return { status: 'failed', error: result.error || 'Email send failed', retryable: true }
    }

    await prisma.brokerSubscriptionPaymentFailureLog.update({
      where: { idempotencyKey },
      data: { status: 'SENT', sentAt: now, messageId: result.messageId || null, lastError: null },
    })
    return { status: 'sent' }
  } catch (error) {
    console.error('Broker payment failure email (durable) failed:', error)
    return { status: 'failed', error: error instanceof Error ? error.message : 'Unknown error', retryable: true }
  }
}
