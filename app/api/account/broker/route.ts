import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import prisma from '@/lib/prisma'
import { isSameOriginRequest, clientIp } from '@/lib/origin'
import { accountDeletionRateLimit } from '@/lib/rateLimit'
import {
  AccountDeletionService,
  AccountDeletionError,
  AccountDeletionStripeError,
} from '@/lib/account-deletion'
import { sendAccountDeletionConfirmationEmail, sendAdminAccountDeletionNotification } from '@/actions/email.action'

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }

  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  if (user.role === 'ADMIN') {
    return NextResponse.json({ error: 'Admin accounts cannot be deleted this way' }, { status: 403 })
  }

  const { success } = await accountDeletionRateLimit.limit(`account-delete:${user.id}`)
  if (!success) {
    return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  if (!body || body.confirm !== true) {
    return NextResponse.json({ error: 'Explicit confirmation is required to delete your account.' }, { status: 400 })
  }

  try {
    const recipientEmail = user.email || ''
    const recipientName = user.name || 'Broker'

    const broker = await prisma.broker.findFirst({
      where: { userId: user.id },
      select: { id: true, companyName: true },
    })

    if (broker) {
      const result = await AccountDeletionService.deleteBrokerAccount(
        { brokerId: broker.id },
        { userId: user.id, role: user.role },
      )
      console.info('Broker account deleted via self-service', { userId: user.id, brokerId: broker.id, result })

      if (recipientEmail) {
        void sendAccountDeletionConfirmationEmail({
          email: recipientEmail,
          name: recipientName,
          accountType: 'Broker',
        })
      }

      // Fire-and-forget admin account-deletion notification for every configured
      // ADMIN_EMAILS recipient — failure must not roll back the deletion.
      void sendAdminAccountDeletionNotification({
        email: recipientEmail,
        name: recipientName,
        accountType: 'Broker',
        companyName: broker.companyName,
        deletedBy: 'USER',
      })

      return NextResponse.json({ success: true, deleted: result.deleted })
    }

    // Registration-only account (broker registration started but never
    // completed): the registration + any registration subscription is removed
    // with the user account.
    const registration = await prisma.brokerRegistration.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })
    if (registration) {
      const result = await AccountDeletionService.deleteUserAccount(
        { userId: user.id },
        { userId: user.id, role: user.role },
      )
      console.info('Broker registration account deleted via self-service', { userId: user.id, result })

      if (recipientEmail) {
        void sendAccountDeletionConfirmationEmail({
          email: recipientEmail,
          name: recipientName,
          accountType: 'User',
        })
      }

      void sendAdminAccountDeletionNotification({
        email: recipientEmail,
        name: recipientName,
        accountType: 'User',
        deletedBy: 'USER',
      })

      return NextResponse.json({ success: true, deleted: result.deleted })
    }

    return NextResponse.json({ error: 'No broker account found for this user' }, { status: 404 })
  } catch (error) {
    if (error instanceof AccountDeletionStripeError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code, retryable: true },
        { status: 502 },
      )
    }
    if (error instanceof AccountDeletionError) {
      return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: 400 })
    }
    console.error('Broker account self-service deletion failed', {
      userId: user.id,
      ip: clientIp(request),
      error,
    })
    return NextResponse.json({ success: false, error: 'Unable to delete your account. Please try again.' }, { status: 500 })
  }
}
