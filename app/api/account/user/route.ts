import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
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
    // Capture email/name BEFORE deletion — the user record may be removed.
    const recipientEmail = user.email || ''
    const recipientName = user.name || 'User'

    // The target is always the authenticated user; a client-supplied userId is
    // never trusted.
    const result = await AccountDeletionService.deleteUserAccount(
      { userId: user.id },
      { userId: user.id, role: user.role },
    )
    console.info('User account deleted via self-service', { userId: user.id, result })

    // Fire-and-forget confirmation email — failure must not roll back deletion.
    if (recipientEmail) {
      void sendAccountDeletionConfirmationEmail({
        email: recipientEmail,
        name: recipientName,
        accountType: 'User',
      })
    }

    // Fire-and-forget admin account-deletion notification — every configured
    // ADMIN_EMAILS recipient. Failure must not roll back the completed deletion.
    void sendAdminAccountDeletionNotification({
      email: recipientEmail,
      name: recipientName,
      accountType: 'User',
      deletedBy: 'USER',
    })

    return NextResponse.json({ success: true, deleted: result.deleted })
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
    console.error('User account self-service deletion failed', {
      userId: user.id,
      ip: clientIp(request),
      error,
    })
    return NextResponse.json({ success: false, error: 'Unable to delete your account. Please try again.' }, { status: 500 })
  }
}
