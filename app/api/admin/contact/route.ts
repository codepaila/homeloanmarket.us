/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/admin/contacts/route.ts
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/currentUser'
import { sendEmail } from '@/lib/email'
import { contactBrokerRateLimit } from '@/lib/rateLimit'

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] || character)

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
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
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

export async function POST(request: NextRequest) {
  try {
    const rate = await contactBrokerRateLimit.limit(`site-contact:${request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'}`)
    if (!rate.success) return NextResponse.json({ success: false, error: 'Too many requests. Please try again later.' }, { status: 429 })

    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
    const subject = typeof body.subject === 'string' ? body.subject.trim() : ''
    const message = typeof body.message === 'string' ? body.message.trim() : ''
    if (name.length < 2 || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || message.length < 10 || message.length > 5000) {
      return NextResponse.json({ success: false, error: 'Please provide a valid name, email, and message.' }, { status: 400 })
    }

    const recipient = process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_CONTACT_EMAIL
    if (!recipient) return NextResponse.json({ success: false, error: 'Contact service is not configured.' }, { status: 503 })
    const result = await sendEmail({
      to: recipient,
      subject: `[HomeLoanMarket contact] ${subject || 'New message'}`,
      html: `<h2>${escapeHtml(subject || 'New message')}</h2><p><strong>From:</strong> ${escapeHtml(name)} (${escapeHtml(email)})</p><p><strong>Phone:</strong> ${escapeHtml(phone || 'Not provided')}</p><p>${escapeHtml(message).replace(/\n/g, '<br />')}</p>`,
      text: `From: ${name} (${email})\nPhone: ${phone || 'Not provided'}\n\n${message}`,
    })
    if (!result.success) return NextResponse.json({ success: false, error: 'Unable to send your message right now.' }, { status: 502 })
    return NextResponse.json({ success: true, message: 'Message sent successfully.' })
  } catch {
    return NextResponse.json({ success: false, error: 'Unable to send your message right now.' }, { status: 500 })
  }
}
