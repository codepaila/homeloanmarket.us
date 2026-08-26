import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import { isSameOriginRequest, clientIp } from '@/lib/origin'
import { accountDeletionRateLimit } from '@/lib/rateLimit'
import {
  AccountDeletionService,
  AccountDeletionError,
  AccountDeletionStripeError,
} from '@/lib/account-deletion'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }

  const admin = await getCurrentUser()
  if (!admin) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  if (admin.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { success } = await accountDeletionRateLimit.limit(`admin-account-delete:${admin.id}`)
  if (!success) {
    return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 })
  }

  const { id } = await params
  if (!id || typeof id !== 'string' || id.length < 1) {
    return NextResponse.json({ error: 'Invalid broker id' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  if (!body || body.confirm !== true) {
    return NextResponse.json({ error: 'Explicit confirmation is required to delete this broker.' }, { status: 400 })
  }

  try {
    // Target comes only from the validated route parameter. Ownership/claim
    // information is never accepted from the client. The service additionally
    // refuses to delete an ADMIN account or the currently logged-in admin.
    const result = await AccountDeletionService.deleteBrokerAccount(
      { brokerId: id },
      { userId: admin.id, role: admin.role },
    )
    console.info('Broker account deleted by admin', { adminId: admin.id, brokerId: id, result })
    return NextResponse.json({ success: true, deleted: result.deleted })
  } catch (error) {
    if (error instanceof AccountDeletionStripeError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code, retryable: true },
        { status: 502 },
      )
    }
    if (error instanceof AccountDeletionError) {
      const status = error.code === 'BROKER_NOT_FOUND' ? 404 : 400
      return NextResponse.json({ success: false, error: error.message, code: error.code }, { status })
    }
    console.error('Admin broker deletion failed', { adminId: admin.id, brokerId: id, ip: clientIp(request), error })
    return NextResponse.json({ success: false, error: 'Unable to delete this broker. Please try again.' }, { status: 500 })
  }
}
