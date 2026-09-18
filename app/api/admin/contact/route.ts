/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/admin/contacts/route.ts
//
// ADMIN-ONLY read surface for platform contact messages. The public contact
// form was moved to POST /api/contact (see lib/contact-submission.ts); this
// route intentionally exposes only the protected GET.
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/currentUser'
import { parseBoundedPositiveInt } from '@/utils'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    // Bounded pagination: reject NaN/Infinity/negative and cap the page size.
    const page = parseBoundedPositiveInt(searchParams.get('page'), 1)
    const limit = Math.min(parseBoundedPositiveInt(searchParams.get('limit'), 20), 100)
    const brokerId = searchParams.get('brokerId')
    const status = searchParams.get('status')
    const search = searchParams.get('search')

    const skip = (page - 1) * limit

    const where: any = {}

    if (brokerId) {
      where.brokerId = brokerId
    }

    if (status && status !== 'all') {
      if (status === 'unread') where.isRead = false
      if (status === 'read') where.isRead = true
      if (status === 'responded') where.isResponded = true
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } }
      ]
    }

    const [contacts, total] = await Promise.all([
      prisma.contactMessage.findMany({
        where,
        include: {
          broker: {
            select: {
              id: true,
              displayName: true,
              companyName: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            }
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true
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

    return NextResponse.json({
      success: true,
      contacts,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page
    })
  } catch (error) {
    console.error('Error fetching admin contacts:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch contacts' },
      { status: 500 }
    )
  }
}
