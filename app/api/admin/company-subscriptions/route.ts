import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import prisma from '@/lib/prisma'

export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const subscriptions = await prisma.companySubscription.findMany({
    include: {
      company: {
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          memberships: {
            where: { role: 'OWNER' },
            select: { user: { select: { id: true, name: true, email: true } } },
            take: 1,
          },
          adRequests: {
            select: { id: true, status: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
      },
      advertisingPlan: { select: { id: true, name: true, price: true, billingInterval: true, isActive: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  return NextResponse.json({ subscriptions })
}

export async function GET_BY_ID() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}