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
    return NextResponse.json({ error: 'Explicit confirmation is required to delete this company.' }, { status: 400 })
  }

  try {
    // Self-service company deletion requires OWNER membership resolved from the
    // authenticated session — the client can never supply a companyId.
    const ownership = await prisma.companyMembership.findFirst({
      where: { userId: user.id, role: 'OWNER', isActive: true },
      select: { companyId: true },
    })
    if (!ownership) {
      return NextResponse.json({ error: 'Only the company owner can delete the company account.' }, { status: 403 })
    }

    const recipientEmail = user.email || ''
    const recipientName = user.name || 'Company Owner'

    // Capture the company name BEFORE deletion — the company record is removed
    // by the service and is no longer readable afterwards.
    const companyRecord = await prisma.company.findUnique({
      where: { id: ownership.companyId },
      select: { name: true },
    })

    const result = await AccountDeletionService.deleteCompanyAccount(
      { companyId: ownership.companyId },
      { userId: user.id, role: user.role },
    )
    console.info('Company account deleted via self-service', { userId: user.id, companyId: ownership.companyId, result })

    if (recipientEmail) {
      void sendAccountDeletionConfirmationEmail({
        email: recipientEmail,
        name: recipientName,
        accountType: 'Company',
      })
    }

    // Fire-and-forget admin account-deletion notification for every configured
    // ADMIN_EMAILS recipient — failure must not roll back the deletion.
    void sendAdminAccountDeletionNotification({
      email: recipientEmail,
      name: recipientName,
      accountType: 'Company',
      companyName: companyRecord?.name ?? null,
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
    console.error('Company account self-service deletion failed', {
      userId: user.id,
      ip: clientIp(request),
      error,
    })
    return NextResponse.json({ success: false, error: 'Unable to delete this company. Please try again.' }, { status: 500 })
  }
}
