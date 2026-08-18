// app/api/admin/brokers/[id]/mortgage-expert/route.ts
// Admin-only Mortgage Expert badge toggle for a specific broker. Updates ONLY
// the admin-controlled badge field; never touches the broker's subscription,
// profile, or status.
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import prisma from '@/lib/prisma'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getCurrentUser()
  if (admin?.role !== 'ADMIN') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const broker = await prisma.broker.findUnique({ where: { id }, select: { id: true } })
  if (!broker) {
    return NextResponse.json({ message: 'Broker not found' }, { status: 404 })
  }

  let enabled: unknown
  try {
    const body = await request.json()
    enabled = body?.enabled
  } catch {
    return NextResponse.json({ message: 'Invalid request body' }, { status: 400 })
  }
  if (typeof enabled !== 'boolean') {
    return NextResponse.json({ message: 'Invalid Mortgage Expert badge value' }, { status: 422 })
  }

  try {
    const updated = await prisma.broker.update({
      where: { id },
      data: { mortgageExpertEnabled: enabled },
      select: { id: true, mortgageExpertEnabled: true },
    })
    console.info('Admin updated Mortgage Expert badge', { adminId: admin.id, brokerId: id, mortgageExpertEnabled: enabled })
    return NextResponse.json({
      message: enabled
        ? 'Mortgage Expert badge enabled successfully.'
        : 'Mortgage Expert badge disabled successfully.',
      mortgageExpertEnabled: updated.mortgageExpertEnabled,
    })
  } catch (error) {
    console.error('Admin Mortgage Expert badge update failed', error)
    return NextResponse.json({ message: 'Unable to update Mortgage Expert badge' }, { status: 500 })
  }
}
