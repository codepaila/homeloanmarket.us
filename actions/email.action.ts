'use server'

import { sendEmail, emailTemplates } from '@/lib/email'
import prisma from '@/lib/prisma'
import crypto from 'crypto'
import { getBrokerContactEmail } from '@/lib/broker-policy'

export async function sendBrokerRegistrationEmails(userId: string) {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                brokerProfile: { take: 1 }
            }
        })

        if (!user) {
            throw new Error('User not found')
        }

        // Generate verification token
        const rawToken = crypto.randomBytes(32).toString("hex")
        const hashedToken = crypto
            .createHash("sha256")
            .update(rawToken)
            .digest("hex")

        const expires = new Date(Date.now() + 1000 * 60 * 60 * 24) // 24 hours

        // Save verification token
        await prisma.user.update({
            where: { id: userId },
            data: {
                emailVerificationToken: hashedToken,
                emailVerificationTokenExpiresAt: expires,
            }
        })

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://homeloanmarket.com'
        const verifyUrl = `${appUrl}/auth/verify-email?token=${rawToken}&email=${encodeURIComponent(user.email || '')}`

        const idempotencyKey = `broker_registration_${user.id}_${Date.now()}`

        // 1. Send verification email to broker
        const brokerTemplate = emailTemplates.brokerWelcome(
            user.name || 'Broker',
            verifyUrl
        )

        const brokerEmailResult = await sendEmail({
            to: user.email!,
            subject: brokerTemplate.subject,
            html: brokerTemplate.html,
            idempotencyKey: `${idempotencyKey}_broker`
        })

        // A profile is created after subscription and onboarding. The admin
        // notification is therefore deferred until that profile exists.
        let adminEmailResult = null
        if (process.env.ADMIN_EMAIL && user.brokerProfile[0]) {
            const adminTemplate = emailTemplates.adminNewBroker(user, user.brokerProfile[0])

            adminEmailResult = await sendEmail({
                to: process.env.ADMIN_EMAIL,
                subject: adminTemplate.subject,
                html: adminTemplate.html,
                idempotencyKey: `${idempotencyKey}_admin`
            })
        }

        return {
            success: true,
            brokerEmail: brokerEmailResult,
            adminEmail: adminEmailResult
        }
    } catch (error) {
        console.error('Error sending broker registration emails:', error)
        return {
            success: false,
            error: 'Failed to send emails',
            details: error instanceof Error ? error.message : 'Unknown error'
        }
    }
}

export async function sendBrokerClaimInvitationEmail(
    brokerId: string,
    recipient: string,
    claimLink: string,
    expiresAt: Date,
    invitationId: string,
) {
    try {
        const broker = await prisma.broker.findUnique({
            where: { id: brokerId },
            select: {
                id: true,
                displayName: true,
                companyName: true,
                profileSlug: true,
            },
        })

        if (!broker) throw new Error('Broker not found')

        const template = emailTemplates.claimInvitation(broker, claimLink, expiresAt)
        const result = await sendEmail({
            to: recipient,
            subject: template.subject,
            html: template.html,
            text: `Claim your HomeLoanMarket profile: ${claimLink}\nThis link expires on ${expiresAt.toISOString()}.`,
            idempotencyKey: `claim_invitation_${invitationId}`,
        })

        await prisma.brokerClaimEvent.create({
            data: {
                brokerClaimId: (await prisma.brokerClaim.findUniqueOrThrow({ where: { brokerId } })).id,
                invitationId,
                eventType: result.success ? 'SENT' : 'FAILED',
                metadata: { delivery: result.success ? 'accepted' : 'failed' },
            },
        })

        return result
    } catch (error) {
        console.error('Error sending broker claim invitation email:', error)
        return {
            success: false,
            error: 'Failed to send claim invitation email',
            details: error instanceof Error ? error.message : 'Unknown error',
        }
    }
}

export async function sendClaimVerificationEmail(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } })
    if (!user?.email) return { success: false, error: 'Claim email not available' }

    const rawToken = crypto.randomBytes(32).toString('hex')
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex')
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    await prisma.user.update({
        where: { id: user.id },
        data: { emailVerificationToken: hashedToken, emailVerificationTokenExpiresAt: expiresAt },
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://homeloanmarket.com'
    const verificationLink = `${appUrl}/auth/verify-email?token=${rawToken}&email=${encodeURIComponent(user.email)}`
    const template = emailTemplates.claimVerification(user.name || 'Broker', verificationLink)
    return sendEmail({
        to: user.email,
        subject: template.subject,
        html: template.html,
        text: `Verify your HomeLoanMarket email: ${verificationLink}`,
        idempotencyKey: `claim_verification_${user.id}_${hashedToken}`,
    })
}

export async function sendUserVerificationEmail(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } })
    if (!user?.email) return { success: false, error: 'Email not available' }

    const rawToken = crypto.randomBytes(32).toString('hex')
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex')
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    await prisma.user.update({
        where: { id: user.id },
        data: { emailVerificationToken: hashedToken, emailVerificationTokenExpiresAt: expiresAt },
    })
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://homeloanmarket.com'
    const verificationLink = `${appUrl}/auth/verify-email?token=${rawToken}&email=${encodeURIComponent(user.email)}`
    const template = emailTemplates.resendVerification(user.name || 'User', verificationLink)
    return sendEmail({
        to: user.email,
        subject: template.subject,
        html: template.html,
        text: `Verify your HomeLoanMarket email: ${verificationLink}`,
        idempotencyKey: `user_verification_${user.id}_${hashedToken}`,
    })
}

export async function sendEmailChangeVerificationEmail(userId: string, newEmail: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true } })
    if (!user) return { success: false, error: 'Account not found' }
    const target = typeof newEmail === 'string' ? newEmail.trim().toLowerCase() : ''
    if (!target || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) return { success: false, error: 'Invalid email address' }

    // Token is stored hashed (sha256); the raw value is only embedded in the
    // email link and is never logged.
    const rawToken = crypto.randomBytes(32).toString('hex')
    const hashedToken = crypto.createHash('sha256').update(`${rawToken}:${target}`).digest('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
    await prisma.user.update({
        where: { id: user.id },
        data: { emailVerificationToken: hashedToken, emailVerificationTokenExpiresAt: expiresAt },
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://homeloanmarket.com'
    const verificationLink = `${appUrl}/auth/verify-email?token=${rawToken}&email=${encodeURIComponent(target)}`
    const template = emailTemplates.emailChangeVerification(user.name || 'User', verificationLink, 1)
    return sendEmail({
        to: target,
        subject: template.subject,
        html: template.html,
        text: `Confirm your new HomeLoanMarket email address: ${verificationLink}`,
        idempotencyKey: `email_change_${user.id}_${hashedToken}`,
    })
}

export async function sendNewLeadNotification(brokerId: string, leadId: string) {
    try {
        const [broker, lead] = await Promise.all([
            prisma.broker.findUnique({
                where: { id: brokerId },
                include: {
                    user: true
                }
            }),
            prisma.contactMessage.findUnique({
                where: { id: leadId }
            })
        ])

        if (!broker || !lead) {
            throw new Error('Broker or lead not found')
        }

        const idempotencyKey = `new_lead_${broker.id}_${lead.id}_${Date.now()}`

        const leadTemplate = emailTemplates.newLead(broker, lead)

        const recipient = getBrokerContactEmail(broker)
        const emailResult = recipient
            ? await sendEmail({
                to: recipient,
                subject: leadTemplate.subject,
                html: leadTemplate.html,
                idempotencyKey
            })
            : null

        // Update lead notification status
        await prisma.contactMessage.update({
            where: { id: leadId },
            data: {
                isRead: false, // Will be marked as read when broker opens dashboard
            }
        })

        return {
            success: true,
            email: emailResult,
            skipped: !recipient
        }
    } catch (error) {
        console.error('Error sending new lead notification:', error)
        return {
            success: false,
            error: 'Failed to send notification',
            details: error instanceof Error ? error.message : 'Unknown error'
        }
    }
}

export async function sendBrokerVerificationEmail(brokerId: string) {
    try {
        const broker = await prisma.broker.findUnique({
            where: { id: brokerId },
            include: {
                user: true
            }
        })

        if (!broker) {
            throw new Error('Broker not found')
        }

        const idempotencyKey = `broker_verified_${broker.id}_${Date.now()}`

        const verificationTemplate = emailTemplates.brokerVerified(broker)

        const recipient = getBrokerContactEmail(broker, true)
        const emailResult = recipient
            ? await sendEmail({
                to: recipient,
                subject: verificationTemplate.subject,
                html: verificationTemplate.html,
                idempotencyKey
            })
            : null

        return {
            success: true,
            email: emailResult,
            skipped: !recipient
        }
    } catch (error) {
        console.error('Error sending broker verification email:', error)
        return {
            success: false,
            error: 'Failed to send verification email',
            details: error instanceof Error ? error.message : 'Unknown error'
        }
    }
}
// In your email.actions.ts file - fix the function
export async function resendBrokerVerificationEmail(brokerId: string) {
    try {
        const broker = await prisma.broker.findUnique({
            where: { id: brokerId },
            include: {
                user: true
            }
        })

        if (!broker) {
            throw new Error('Broker not found')
        }

        if (!broker.user?.id || !broker.user.email) {
            throw new Error('Broker owner email not found')
        }

        // Generate NEW verification token
        const rawToken = crypto.randomBytes(32).toString("hex")
        const hashedToken = crypto
            .createHash("sha256")
            .update(rawToken)
            .digest("hex")

        const expires = new Date(Date.now() + 1000 * 60 * 60 * 24) // 24 hours

        // Update user with new verification token
        await prisma.user.update({
            where: { id: broker.user.id },
            data: {
                emailVerificationToken: hashedToken,
                emailVerificationTokenExpiresAt: expires,
                emailVerified: false,
                updatedAt: new Date()
            }
        })

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://homeloanmarket.com'
        const verifyUrl = `${appUrl}/auth/verify-email?token=${rawToken}&email=${encodeURIComponent(broker.user.email)}`

        const idempotencyKey = `resend_verification_${broker.id}_${Date.now()}`

        // Send verification email
        const verificationTemplate = emailTemplates.resendVerification(
            broker.user.name || 'Broker',
            verifyUrl
        )

        const emailResult = await sendEmail({
            to: broker.user.email,
            subject: verificationTemplate.subject,
            html: verificationTemplate.html,
            idempotencyKey
        })

        return {
            success: true,
            email: emailResult
        }
    } catch (error) {
        console.error('Error resending broker verification email:', error)
        return {
            success: false,
            error: 'Failed to resend verification email',
            details: error instanceof Error ? error.message : 'Unknown error'
        }
    }
}
export async function sendSubscriptionEmail(brokerId: string, subscriptionId: string) {
    try {
        const [broker, subscription] = await Promise.all([
            prisma.broker.findUnique({
                where: { id: brokerId },
                include: {
                    user: true
                }
            }),
            prisma.brokerSubscription.findUnique({
                where: { id: subscriptionId }
            })
        ])

        if (!broker || !subscription) {
            throw new Error('Broker or subscription not found')
        }

        const idempotencyKey = `subscription_${broker.id}_${subscription.id}_${Date.now()}`

        const subscriptionTemplate = emailTemplates.subscriptionPurchased(broker, subscription)

        const recipient = getBrokerContactEmail(broker, true)
        const emailResult = recipient
            ? await sendEmail({
                to: recipient,
                subject: subscriptionTemplate.subject,
                html: subscriptionTemplate.html,
                idempotencyKey
            })
            : null

        return {
            success: true,
            email: emailResult,
            skipped: !recipient
        }
    } catch (error) {
        console.error('Error sending subscription email:', error)
        return {
            success: false,
            error: 'Failed to send subscription email',
            details: error instanceof Error ? error.message : 'Unknown error'
        }
    }
}

export async function sendNewReviewNotification(reviewId: string) {
    try {
        const review = await prisma.review.findUnique({
            where: { id: reviewId },
            include: {
                broker: {
                    include: {
                        user: true
                    }
                },
                user: true
            }
        })

        if (!review || !review.broker) {
            throw new Error('Review or broker not found')
        }

        const idempotencyKey = `new_review_${review.id}_${Date.now()}`

        const reviewTemplate = emailTemplates.newReview(
            review.broker,
            review,
            review.user || { name: 'Anonymous' }
        )

        const recipient = getBrokerContactEmail(review.broker, true)
        const emailResult = recipient
            ? await sendEmail({
                to: recipient,
                subject: reviewTemplate.subject,
                html: reviewTemplate.html,
                idempotencyKey
            })
            : null

        return {
            success: true,
            email: emailResult,
            skipped: !recipient
        }
    } catch (error) {
        console.error('Error sending new review notification:', error)
        return {
            success: false,
            error: 'Failed to send notification',
            details: error instanceof Error ? error.message : 'Unknown error'
        }
    }
}

export async function sendPasswordResetEmail(email: string) {
    try {
        const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
        console.log(`📧 Attempting to send reset email to: ${normalizedEmail}`)

        // Check if email exists (but don't reveal)
        const user = await prisma.user.findUnique({
            where: { email: normalizedEmail }
        })

        if (!user) {
            console.log(`⚠️ Email not found in database: ${normalizedEmail}`)
            return { success: true } // Don't reveal user existence
        }

        // Generate reset token
        const rawToken = crypto.randomBytes(32).toString("hex")
        const hashedToken = crypto
            .createHash("sha256")
            .update(rawToken)
            .digest("hex")

        const expires = new Date(Date.now() + 1000 * 60 * 60) // 1 hour

        // Update user with reset token
        await prisma.user.update({
            where: { id: user.id },
            data: {
                resetPasswordToken: hashedToken,
                resetPasswordTokenExpiry: expires
            }
        })

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://homeloanmarket.com'
        // The canonical reset page reads `token` and `email` query params.
        // Never log the raw reset token or the email-send result.
        const resetUrl = `${appUrl}/auth/reset-password?token=${rawToken}&email=${encodeURIComponent(normalizedEmail)}`

        const resetTemplate = emailTemplates.passwordReset(
            user.name || 'User',
            resetUrl,
            1
        )

        const emailResult = await sendEmail({
            to: normalizedEmail,
            subject: resetTemplate.subject,
            html: resetTemplate.html,
            text: `Reset your HomeLoanMarket password: ${resetUrl}\n\nThis link expires in 1 hour.`,
            idempotencyKey: `reset_${user.id}_${Date.now()}`
        })

        if (emailResult.success) {
            console.log(`✅ Reset email sent successfully to: ${normalizedEmail}`)
            return {
                success: true,
                messageId: emailResult.messageId
            }
        } else {
            console.error(`❌ Failed to send email to ${normalizedEmail}:`, emailResult.error)
            return {
                success: false,
                error: 'Failed to send email',
                details: emailResult.error
            }
        }
    } catch (error) {
        console.error('❌ Error in sendPasswordResetEmail:', error)
        return {
            success: false,
            error: 'Failed to process reset request',
            details: error instanceof Error ? error.message : 'Unknown error'
        }
    }
}

export async function sendSupportTicketNotification(ticketId: string) {
    try {
        const ticket = await prisma.supportTicket.findUnique({
            where: { id: ticketId },
            include: {
                user: true
            }
        })

        if (!ticket) {
            throw new Error('Ticket not found')
        }

        const idempotencyKey = `support_ticket_${ticket.id}_${Date.now()}`

        const notificationTemplate = emailTemplates.notification(
            `Support Ticket Created: ${ticket.ticketNumber}`,
            `Your support request has been received and will be processed shortly.`,
            {
                "Ticket Number": ticket.ticketNumber,
                "Category": ticket.category,
                "Priority": ticket.priority,
                "Status": ticket.status,
                "Created At": new Date(ticket.createdAt).toLocaleString(),
                "Reference": `Keep this ticket number for reference: ${ticket.ticketNumber}`
            }
        )

        const emailResult = await sendEmail({
            to: ticket.user.email!,
            subject: notificationTemplate.subject,
            html: notificationTemplate.html,
            idempotencyKey
        })

        // Also notify admin if ticket is high priority
        if (ticket.priority === 'high' || ticket.priority === 'urgent') {
            const adminTemplate = emailTemplates.notification(
                `🔴 High Priority Support Ticket: ${ticket.ticketNumber}`,
                `A high priority support ticket has been created and requires immediate attention.`,
                {
                    "Ticket Number": ticket.ticketNumber,
                    "User": `${ticket.user.name} (${ticket.user.email})`,
                    "Category": ticket.category,
                    "Priority": ticket.priority,
                    "Subject": ticket.subject,
                    "Created At": new Date(ticket.createdAt).toLocaleString(),
                    "Ticket URL": `${process.env.NEXT_PUBLIC_APP_URL}/admin/support/${ticket.id}`
                }
            )

            await sendEmail({
                to: process.env.ADMIN_EMAIL!,
                subject: adminTemplate.subject,
                html: adminTemplate.html,
                idempotencyKey: `${idempotencyKey}_admin`
            })
        }

        return {
            success: true,
            email: emailResult
        }
    } catch (error) {
        console.error('Error sending support ticket notification:', error)
        return {
            success: false,
            error: 'Failed to send notification',
            details: error instanceof Error ? error.message : 'Unknown error'
        }
    }
}

// Debug email delivery
export async function debugEmailDelivery(email: string) {
    console.log('🔍 Email Delivery Debug:')
    console.log('1. App URL:', process.env.NEXT_PUBLIC_APP_URL)
    console.log('2. From Address:', process.env.EMAIL_FROM)
    console.log('3. To Address:', email)
    console.log('4. Time:', new Date().toISOString())

    // Test with a simple email
    const testEmail = {
        to: email,
        subject: 'HomeLoanMarket Test Email',
        html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>HomeLoanMarket Test Email</h2>
        <p>If you can see this, email delivery is working!</p>
        <p>Sent at: ${new Date().toISOString()}</p>
        <p>From: ${process.env.EMAIL_FROM}</p>
      </div>
    `,
        text: 'HomeLoanMarket Test Email - If you can see this, email delivery is working!'
    }

    return await sendEmail(testEmail)
}
