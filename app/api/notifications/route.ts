import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/currentUser'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const rawPage = Number.parseInt(searchParams.get('page') || '1', 10)
  const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1
  const pageSize = 10
  const readFilter = searchParams.get('read')
  const read = readFilter === 'true' ? true : readFilter === 'false' ? false : undefined

  const where = {
    userId: user.id,
    ...(read === undefined ? {} : { isRead: read }),
  }

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.notification.count({ where }),
  ])

  return NextResponse.json({
    notifications: notifications.map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      isRead: n.isRead,
      createdAt: n.createdAt.toISOString(),
    })),
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  })
}