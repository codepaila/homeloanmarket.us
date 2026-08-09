// app/api/contact/send/route.ts
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { emailTemplates } from '@/lib/email-templates'
import { isPublicBroker } from '@/lib/broker-policy'
import { contactBrokerRateLimit } from '@/lib/rateLimit'
import { getClientIP } from '@/lib/advertisements/utils'

export async function POST(request: NextRequest) {
  try {
    const rateLimit = await contactBrokerRateLimit.limit(`contact:${getClientIP(request.headers)}`)
    if (!rateLimit.success) {
      return NextResponse.json(
        { success: false, error: 'Too many contact attempts. Please try again later.' },
        { status: 429 },
      )
    }

    const body = await request.json()
    const {
      brokerId,
      brokerSlug,
      name,
      email,
      phone,
      subject,
      message,
      contactType,
      city,
      propertyType,
      loanType,
      loanAmount,
      timeline,
      agreeToMarketing,
      agreeToTerms
    } = body

    // Validate required fields
    if (!name || !email || !phone || !message || !agreeToTerms) {
      return NextResponse.json(
        { success: false, error: 'Please fill all required fields and agree to terms' },
        { status: 400 }
      )
    }

    // The public broker profile only exposes the canonical profileSlug, never
    // the internal document id. Resolve the target broker by slug (unique) with
    // an id fallback for any existing callers.
    if (!brokerSlug && !brokerId) {
      return NextResponse.json(
        { success: false, error: 'Broker identifier is required' },
        { status: 400 }
      )
    }

    const broker = await prisma.broker.findUnique({
      where: brokerSlug ? { profileSlug: brokerSlug } : { id: brokerId },
      include: {
        user: { select: { email: true, isActive: true } },
      }
    })

    if (!broker || !isPublicBroker({
      isVisible: broker.isVisible,
      verificationStatus: broker.verificationStatus,
      brokerStatus: broker.brokerStatus,
      userId: broker.userId,
      userIsActive: broker.user?.isActive,
    })) {
      return NextResponse.json(
        { success: false, error: 'Broker not found' },
        { status: 404 }
      )
    }

    // Create contact message against the resolved broker
    const contactMessage = await prisma.contactMessage.create({
      data: {
        brokerId: broker.id,
        name,
        email,
        phone,
        subject: subject || `Inquiry from ${name}`,
        message,
        contactType,
        propertyType,
        loanType,
        loanAmount,
        timeline,
        agreeToMarketing,
        agreeToTerms,
        city: city ||  'Not specified',
      }
    })

    // Update broker's contact message count
    await prisma.broker.update({
      where: { id: broker.id },
      data: {
        totalLeads: { increment: 1 }
      }
    })

    // Send email notification to broker if they have an email
    const brokerNotificationEmail = broker.email || broker.user?.email
    if (brokerNotificationEmail) {
      try {
        const brokerTemplate = emailTemplates.newContactMessage(broker, {
          ...contactMessage,
          createdAt: contactMessage.createdAt,
        })
        await sendEmail({
          to: brokerNotificationEmail,
          subject: brokerTemplate.subject,
          html: brokerTemplate.html,
          text: brokerTemplate.html.replace(/<[^>]*>/g, ''),
        })
      } catch (emailError) {
        console.error('Failed to send broker notification email:', emailError)
      }
    }

    // Send confirmation email to customer
    if (email) {
      try {
        const customerTemplate = emailTemplates.contactMessageConfirmation(
          { name, email },
          broker,
          { ...contactMessage, createdAt: contactMessage.createdAt }
        )
        await sendEmail({
          to: email,
          subject: customerTemplate.subject,
          html: customerTemplate.html,
          text: customerTemplate.html.replace(/<[^>]*>/g, ''),
        })
      } catch (emailError) {
        console.error('Failed to send customer confirmation email:', emailError)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Your message has been sent successfully',
      data: {
        messageId: contactMessage.id,
        brokerName: broker.displayName,
        estimatedResponseTime: '24 hours'
      }
    })
  } catch (error) {
    console.error('Error sending contact message:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to send message. Please try again.' 
      },
      { status: 500 }
    )
  }
}
