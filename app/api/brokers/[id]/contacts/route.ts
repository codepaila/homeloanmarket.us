/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/brokers/[id]/contacts/route.ts
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/currentUser'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const brokerId = params.id
    const currentUser = await getCurrentUser()

    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const broker = await prisma.broker.findUnique({
      where: { id: brokerId },
      select: { userId: true },
    })

    if (!broker) {
      return NextResponse.json(
        { success: false, error: 'Broker not found' },
        { status: 404 }
      )
    }

    if (currentUser.role !== 'ADMIN' && broker.userId !== currentUser.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status') // all, unread, read, responded
    const contactType = searchParams.get('contactType') // all, email, phone, whatsapp, sms
    const search = searchParams.get('search')

    const skip = (page - 1) * limit

    const where: any = {
      brokerId
    }

    // Filter by status
    if (status && status !== 'all') {
      if (status === 'unread') where.isRead = false
      if (status === 'read') where.isRead = true
      if (status === 'responded') where.isResponded = true
    }

    // Filter by contact type
    if (contactType && contactType !== 'all') {
      where.contactType = contactType
    }

    // Search
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
        { message: { contains: search, mode: 'insensitive' } }
      ]
    }

    const [contacts, total] = await Promise.all([
      prisma.contactMessage.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.contactMessage.count({ where })
    ])

    // Get stats
    const totalMessages = await prisma.contactMessage.count({ where: { brokerId } })
    const unreadMessages = await prisma.contactMessage.count({ 
      where: { brokerId, isRead: false } 
    })
    const respondedMessages = await prisma.contactMessage.count({ 
      where: { brokerId, isResponded: true } 
    })

    // This month count
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)
    
    const thisMonth = await prisma.contactMessage.count({
      where: {
        brokerId,
        createdAt: { gte: startOfMonth }
      }
    })

    return NextResponse.json({
      success: true,
      contacts,
      stats: {
        total: totalMessages,
        unread: unreadMessages,
        responded: respondedMessages,
        thisMonth
      },
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page
    })
  } catch (error) {
    console.error('Error fetching contact messages:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch contact messages' },
      { status: 500 }
    )
  }
}
