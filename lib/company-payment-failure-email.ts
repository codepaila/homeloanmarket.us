// lib/company-payment-failure-email.ts
import { sendEmail, emailTemplates } from '@/lib/email'
import prisma from '@/lib/prisma'
import { platformConfig } from '@/lib/platform-config'
import type { Prisma, CompanySubscriptionPaymentFailureEmailStatus } from '@prisma/client'

const CLAIM_LEASE_MS = 5 * 60 * 1000

export type CompanyPaymentFailureEmailResult =
  | { status: 'sent' }
  | { status: 'skipped'; reason: 'already_sent' | 'not_found' | 'no_recipient' | 'claim_lost' }
  | { status: 'failed'; error: string; retryable: boolean }

export async function sendCompanyPaymentFailureEmailDurable(companySubscriptionId: string, invoiceId: string): Promise<CompanyPaymentFailureEmailResult> {
  const idempotencyKey = `payment_failure_company_${companySubscriptionId}_${invoiceId}`
  const now = new Date()

  try {
    try {
      await prisma.companySubscriptionPaymentFailureLog.upsert({
        where: { idempotencyKey },
        update: {},
        create: { idempotencyKey, companySubscriptionId, invoiceId, status: 'PENDING' },
      })
    } catch (error) {
      if ((error as { code?: string } | null)?.code !== 'P2002') throw error
    }

    const current = await prisma.companySubscriptionPaymentFailureLog.findUnique({ where: { idempotencyKey } })
    if (current?.status === 'SENT') return { status: 'skipped', reason: 'already_sent' }

    const claimed = await prisma.companySubscriptionPaymentFailureLog.updateMany({
      where: {
        idempotencyKey,
        OR: [
          { status: { in: ['PENDING', 'FAILED'] } as Prisma.EnumCompanySubscriptionPaymentFailureEmailStatusFilter },
          { status: 'PROCESSING', leaseExpiresAt: { lte: now } },
        ],
      },
      data: { status: 'PROCESSING', attempts: { increment: 1 }, claimedAt: now, leaseExpiresAt: new Date(now.getTime() + CLAIM_LEASE_MS), lastError: null },
    })
    if (claimed.count !== 1) return { status: 'skipped', reason: 'claim_lost' }

    const subscription = await prisma.companySubscription.findUnique({
      where: { id: companySubscriptionId },
      include: {
        company: {
          include: {
            memberships: {
              where: { role: 'OWNER', isActive: true },
              include: { user: true },
              orderBy: { id: 'asc' },
            },
          },
        },
      },
    })
    if (!subscription?.company) {
      await prisma.companySubscriptionPaymentFailureLog.update({ where: { idempotencyKey }, data: { status: 'FAILED', lastError: 'Company subscription not found' } })
      return { status: 'failed', error: 'Company subscription not found', retryable: false }
    }
    const recipient = subscription.company.memberships[0]?.user?.email
    if (!recipient) {
      await prisma.companySubscriptionPaymentFailureLog.update({ where: { idempotencyKey }, data: { status: 'SENT', sentAt: now, messageId: null, lastError: 'no recipient email' } })
      return { status: 'skipped', reason: 'no_recipient' }
    }

    const template = emailTemplates.paymentFailure(
      subscription.company.name || 'there',
      'Company Advertising',
      `${platformConfig.appUrl}/company/dashboard`,
    )

    let result
    try {
      result = await sendEmail({
        to: recipient,
        subject: template.subject,
        html: template.html,
        text: `Your HomeLoanMarket company subscription payment failed. Please update your billing info: ${platformConfig.appUrl}/company/dashboard`,
        idempotencyKey,
      })
    } catch (sendError) {
      await prisma.companySubscriptionPaymentFailureLog.update({
        where: { idempotencyKey },
        data: { status: 'FAILED', lastError: sendError instanceof Error ? sendError.message : 'Unknown send error' },
      })
      return { status: 'failed', error: sendError instanceof Error ? sendError.message : 'Unknown send error', retryable: true }
    }

    if (!result.success) {
      await prisma.companySubscriptionPaymentFailureLog.update({
        where: { idempotencyKey },
        data: { status: 'FAILED', lastError: result.error || 'Email send failed' },
      })
      return { status: 'failed', error: result.error || 'Email send failed', retryable: true }
    }

    await prisma.companySubscriptionPaymentFailureLog.update({
      where: { idempotencyKey },
      data: { status: 'SENT', sentAt: now, messageId: result.messageId || null, lastError: null },
    })
    return { status: 'sent' }
  } catch (error) {
    console.error('Company payment failure email (durable) failed:', error)
    return { status: 'failed', error: error instanceof Error ? error.message : 'Unknown error', retryable: true }
  }
}
