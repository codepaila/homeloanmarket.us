// lib/company-subscription-email.ts
//
// Durable, concurrency-safe delivery of the Company subscription purchase/
// activation email.
//
// Activation identity is the authoritative Stripe subscription: the idempotency
// key is scoped to (companySubscriptionId, stripeSubscriptionId). Each
// genuinely new Stripe subscription activation of the SAME CompanySubscription
// (e.g. after a cancel + re-subscribe) is independently represented and
// idempotent, while webhook retries/replays for the SAME Stripe subscription
// always collapse to one durable record. The CompanySubscription row itself is
// still reused (one row per company) — never duplicated.
//
// Stale-subscription safety is enforced upstream: updateCompanySubscriptionFromStripe
// refuses to overwrite a live, different Stripe subscription, so a replay of an
// old subscription's webhook cannot reach this sender after a newer one is
// current.
import { sendEmail, emailTemplates } from '@/lib/email'
import prisma from '@/lib/prisma'
import { platformConfig } from '@/lib/platform-config'
import type { Prisma, CompanySubscriptionEmailStatus } from '@prisma/client'

export type CompanyPurchaseEmailResult =
  | { status: 'sent' }
  | { status: 'skipped'; reason: 'already_sent' | 'not_found' | 'no_recipient' | 'claim_lost' }
  | { status: 'failed'; error: string; retryable: boolean }

const CLAIM_LEASE_MS = 5 * 60 * 1000

function claimEligibleWhere(idempotencyKey: string, now: Date): Prisma.CompanySubscriptionEmailLogWhereInput {
  return {
    idempotencyKey,
    OR: [
      { status: { in: ['PENDING', 'FAILED'] as CompanySubscriptionEmailStatus[] } },
      { status: 'PROCESSING', leaseExpiresAt: { lte: now } },
    ],
  }
}

// stripeSubscriptionId is the authoritative Stripe subscription identity
// (Stripe `Subscription.id`). It distinguishes a genuinely new activation from
// a replay/retry of the same activation. The free-activation path never
// invokes this sender; the null-safe suffix keeps the key valid when no Stripe
// subscription exists (defensive only).
export async function sendCompanySubscriptionPurchaseEmailDurable(
  companySubscriptionId: string,
  stripeSubscriptionId?: string | null,
): Promise<CompanyPurchaseEmailResult> {
  const idempotencyKey = `company_subscription_activation_${companySubscriptionId}${stripeSubscriptionId ? `_${stripeSubscriptionId}` : ''}`
  const now = new Date()

  try {
    try {
      await prisma.companySubscriptionEmailLog.upsert({
        where: { idempotencyKey },
        update: {},
        create: { idempotencyKey, companySubscriptionId, stripeSubscriptionId: stripeSubscriptionId || null, status: 'PENDING' },
      })
    } catch (error) {
      if ((error as { code?: string } | null)?.code !== 'P2002') throw error
    }

    const current = await prisma.companySubscriptionEmailLog.findUnique({ where: { idempotencyKey } })
    if (current?.status === 'SENT') return { status: 'skipped', reason: 'already_sent' }

    const claimed = await prisma.companySubscriptionEmailLog.updateMany({
      where: claimEligibleWhere(idempotencyKey, now),
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
            },
          },
        },
        advertisingPlan: true,
      },
    })
    if (!subscription?.company) {
      await prisma.companySubscriptionEmailLog.update({ where: { idempotencyKey }, data: { status: 'FAILED', lastError: 'Company subscription not found' } })
      return { status: 'failed', error: 'Company subscription not found', retryable: false }
    }

    const ownerMembership = subscription.company.memberships[0]
    const recipient = ownerMembership?.user?.email
    if (!recipient) {
      await prisma.companySubscriptionEmailLog.update({ where: { idempotencyKey }, data: { status: 'SENT', sentAt: now, messageId: null, lastError: 'no recipient email' } })
      return { status: 'skipped', reason: 'no_recipient' }
    }

    const plan = subscription.advertisingPlan
    const template = emailTemplates.companySubscriptionPurchased({
      companyName: subscription.company.name,
      planName: plan?.name || subscription.plan,
      priceCents: typeof plan?.price === 'number' ? plan.price : 0,
      currency: plan?.currency || 'usd',
      interval: plan?.billingInterval || 'month',
      startDate: subscription.startDate || new Date(),
      endDate: subscription.endDate,
      dashboardUrl: `${platformConfig.appUrl}/company/dashboard`,
    })

    let result
    try {
      result = await sendEmail({
        to: recipient,
        subject: template.subject,
        html: template.html,
        text: `Your HomeLoanMarket ${plan?.name || subscription.plan} subscription is active. Manage it: ${platformConfig.appUrl}/company/dashboard`,
        idempotencyKey,
      })
    } catch (sendError) {
      await prisma.companySubscriptionEmailLog.update({
        where: { idempotencyKey },
        data: { status: 'FAILED', lastError: sendError instanceof Error ? sendError.message : 'Unknown send error' },
      })
      return { status: 'failed', error: sendError instanceof Error ? sendError.message : 'Unknown send error', retryable: true }
    }

    if (!result.success) {
      await prisma.companySubscriptionEmailLog.update({
        where: { idempotencyKey },
        data: { status: 'FAILED', lastError: result.error || 'Email send failed' },
      })
      return { status: 'failed', error: result.error || 'Email send failed', retryable: true }
    }

    await prisma.companySubscriptionEmailLog.update({
      where: { idempotencyKey },
      data: { status: 'SENT', sentAt: now, messageId: result.messageId || null, lastError: null },
    })
    return { status: 'sent' }
  } catch (error) {
    console.error('Company subscription purchase email (durable) failed:', error)
    return { status: 'failed', error: error instanceof Error ? error.message : 'Unknown error', retryable: true }
  }
}
