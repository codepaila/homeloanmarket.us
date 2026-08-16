import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import prisma from '@/lib/prisma'
import { issueBrokerClaimInvitation, ClaimInvitationError } from '@/lib/claim-invitation'
import { checkEmailRateLimit } from '@/lib/rateLimit'
import { sendBrokerClaimInvitationEmail } from '@/actions/email.action'
import { isSameOriginRequest } from '@/lib/origin'
import { friendlyClaimErrorMessage } from '@/lib/claim-errors'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type BulkResult = {
  brokerId: string
  brokerName: string
  recipientEmail: string
  status: 'SENT' | 'FAILED' | 'SKIPPED'
  invitationId?: string
  errorCode?: string
  errorMessage?: string
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const admin = await getCurrentUser()
  if (admin?.role !== 'ADMIN') return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const items = Array.isArray(body.items) ? body.items : []
  if (items.length === 0 || items.length > 50) {
    return NextResponse.json({ message: 'Provide between 1 and 50 invitation items' }, { status: 422 })
  }

  const batchLimit = checkEmailRateLimit(admin.email || admin.id, 'claim-invitation-bulk')
  if (!batchLimit.allowed) return NextResponse.json({ message: batchLimit.message }, { status: 429 })

  // Load brokers and their active invitations once (avoid N+1 per item).
  const brokerIds: string[] = []
  for (const item of items) {
    const id = typeof item?.brokerId === 'string' ? item.brokerId : ''
    if (id && !brokerIds.includes(id)) brokerIds.push(id)
  }
  const brokers = await prisma.broker.findMany({
    where: { id: { in: brokerIds } },
    select: {
      id: true,
      displayName: true,
      companyName: true,
      claim: {
        select: {
          invitations: {
            where: { status: 'ACTIVE' },
            select: {
              recipientEmail: true,
              events: { orderBy: { occurredAt: 'desc' }, take: 1, select: { eventType: true } },
            },
          },
        },
      },
    },
  })
  const brokerMap = new Map(brokers.map((broker) => [broker.id, broker]))

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://homeloanmarket.com'

  const results: BulkResult[] = []
  for (const item of items) {
    const brokerId = typeof item?.brokerId === 'string' ? item.brokerId : ''
    const recipientEmail = typeof item?.recipientEmail === 'string' ? item.recipientEmail.trim().toLowerCase() : ''
    const broker = brokerMap.get(brokerId)
    const brokerName = broker ? (broker.companyName || broker.displayName) : ''

    if (!brokerId || !broker) {
      results.push({ brokerId, brokerName, recipientEmail, status: 'FAILED', errorCode: 'BROKER_NOT_FOUND', errorMessage: friendlyClaimErrorMessage('BROKER_NOT_FOUND') })
      continue
    }
    if (!EMAIL_PATTERN.test(recipientEmail)) {
      results.push({ brokerId, brokerName, recipientEmail, status: 'FAILED', errorCode: 'INVALID_EMAIL', errorMessage: friendlyClaimErrorMessage('INVALID_EMAIL') })
      continue
    }

    // Idempotency: skip only when an active invitation to the same recipient
    // already had its email ACCEPTED. An invitation whose email FAILED at the
    // provider is retryable (issueBrokerClaimInvitation supersedes the stale
    // active invitation and sends a fresh one).
    const activeInvitation = broker.claim?.invitations.find((invitation) => invitation.recipientEmail === recipientEmail)
    const emailAccepted = activeInvitation?.events[0]?.eventType === 'SENT'
    if (activeInvitation && emailAccepted) {
      results.push({ brokerId, brokerName, recipientEmail, status: 'SKIPPED', errorCode: 'ALREADY_INVITED', errorMessage: friendlyClaimErrorMessage('ALREADY_INVITED') })
      continue
    }

    const emailLimit = checkEmailRateLimit(recipientEmail, 'claim-invitation-bulk-recipient')
    if (!emailLimit.allowed) {
      results.push({ brokerId, brokerName, recipientEmail, status: 'FAILED', errorCode: 'RATE_LIMITED', errorMessage: friendlyClaimErrorMessage('RATE_LIMITED') })
      continue
    }

    try {
      const result = await issueBrokerClaimInvitation(brokerId, admin.id, recipientEmail)
      const email = await sendBrokerClaimInvitationEmail(
        brokerId,
        recipientEmail,
        `${appUrl}/claim-broker/${result.rawToken}`,
        result.expiresAt,
        result.invitationId,
      )
      results.push(email.success
        ? { brokerId, brokerName, recipientEmail, status: 'SENT', invitationId: result.invitationId }
        : { brokerId, brokerName, recipientEmail, status: 'FAILED', errorCode: 'EMAIL_DELIVERY_FAILED', errorMessage: friendlyClaimErrorMessage('EMAIL_DELIVERY_FAILED') })
    } catch (error) {
      if (error instanceof ClaimInvitationError) {
        results.push({ brokerId, brokerName, recipientEmail, status: 'FAILED', errorCode: error.code, errorMessage: friendlyClaimErrorMessage(error.code) })
      } else {
        console.error('Bulk claim invitation item failed', { brokerId, error })
        results.push({ brokerId, brokerName, recipientEmail, status: 'FAILED', errorCode: 'UNEXPECTED_ERROR', errorMessage: friendlyClaimErrorMessage('UNEXPECTED_ERROR') })
      }
    }
  }

  const summary = {
    total: results.length,
    sent: results.filter((result) => result.status === 'SENT').length,
    failed: results.filter((result) => result.status === 'FAILED').length,
    skipped: results.filter((result) => result.status === 'SKIPPED').length,
  }

  return NextResponse.json({ summary, results }, { status: 200 })
}
