'use server'

import { sendEmail, emailTemplates } from '@/lib/email'
import prisma from '@/lib/prisma'
import crypto from 'crypto'
import { sendBrokerSubscriptionPurchaseEmailDurable } from '@/lib/broker-subscription-email'

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

        const idempotencyKey = `broker_registration_${user.id}`

        // 1. Send verification email to broker
        const brokerTemplate = emailTemplates.brokerWelcome(
            user.name || 'Broker',
            verifyUrl
        )

        const brokerEmailResult = await sendEmail({
            to: user.email!,
            subject: brokerTemplate.subject,
            html: brokerTemplate.html,
            text: `Verify your HomeLoanMarket email: ${verifyUrl}`,
            idempotencyKey: `${idempotencyKey}_broker`
        })

        // A profile is created after subscription and onboarding. The admin
        // notification is therefore deferred until that profile exists.
        let adminEmailResult = null
        if (process.env.ADMIN_EMAIL && user.brokerProfile[0]) {
            const brokerProfile = user.brokerProfile[0]
            const adminTemplate = emailTemplates.adminNewBroker({
                brokerDisplayName: brokerProfile.displayName,
                brokerCompanyName: brokerProfile.companyName,
                brokerCity: brokerProfile.city,
                brokerExperienceYears: brokerProfile.experienceYears,
                userEmail: user.email || '',
                adminUrl: `${appUrl}/admin/brokers/${brokerProfile.id}`,
            })

            adminEmailResult = await sendEmail({
                to: process.env.ADMIN_EMAIL,
                subject: adminTemplate.subject,
                html: adminTemplate.html,
                idempotencyKey: `${idempotencyKey}_admin`
            })
        }

        // Propagate the actual provider result. The broker verification email
        // is the critical delivery; an admin notification must not turn the
        // result into a false success when the broker email was rejected.
        return {
            success: brokerEmailResult.success,
            ...(brokerEmailResult.success ? {} : {
                error: 'Failed to send verification email',
                details: brokerEmailResult.error,
            }),
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

        const template = emailTemplates.claimInvitation({
            displayName: broker.displayName || '',
            claimLink,
        })
        const result = await sendEmail({
            to: recipient,
            subject: template.subject,
            html: template.html,
            text: `Hi ${broker.displayName || 'there'},\n\nYour mortgage professional profile is now listed on HomeLoanMarket.com, helping local homebuyers discover and connect with mortgage professionals in their area.\n\nClaim your profile for FREE to review your information, update your details, add or change your photo, and manage your listing.\n\nClaim Your Profile:\n${claimLink}\n\nHomeLoanMarket is built to give local mortgage professionals greater exposure to a large, hard-to-reach homebuyer community.\n\nThere is no cost to claim or maintain your basic listing.\n\nIf you prefer not to be listed on HomeLoanMarket, you can also remove your profile at any time.\n\nBest,\nHomeLoanMarket Team\nHomeLoanMarket.com`,
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

        const idempotencyKey = `resend_verification_${broker.id}_${hashedToken}`

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

        // Propagate the actual provider result so the API can distinguish a
        // delivered/accepted message from a rejected send.
        if (!emailResult.success) {
            return {
                success: false,
                error: emailResult.error || 'Failed to resend verification email',
                details: emailResult.error,
                email: emailResult,
            }
        }

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

        const resetTemplate = emailTemplates.passwordReset({
            name: user.name || 'User',
            resetLink: resetUrl,
            expiryHours: 1,
        })

        const emailResult = await sendEmail({
            to: normalizedEmail,
            subject: resetTemplate.subject,
            html: resetTemplate.html,
            text: `Reset your HomeLoanMarket password: ${resetUrl}\n\nThis link expires in 1 hour.`,
            idempotencyKey: `reset_${user.id}_${hashedToken}`
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

        const idempotencyKey = `support_ticket_${ticket.id}`

        const notificationTemplate = emailTemplates.notification({
            title: `Support Ticket Created: ${ticket.ticketNumber}`,
            message: `Your support request has been received and will be processed shortly.`,
            info: {
                "Ticket Number": ticket.ticketNumber,
                "Category": ticket.category,
                "Priority": ticket.priority,
                "Status": ticket.status,
                "Created At": new Date(ticket.createdAt).toLocaleString(),
                "Reference": `Keep this ticket number for reference: ${ticket.ticketNumber}`,
            },
        })

        const emailResult = await sendEmail({
            to: ticket.user.email!,
            subject: notificationTemplate.subject,
            html: notificationTemplate.html,
            idempotencyKey
        })

        // Also notify admin if ticket is high priority. High-priority flag is
        // only applied to this genuinely urgent administrative alert.
        if (ticket.priority === 'high' || ticket.priority === 'urgent') {
            const adminTemplate = emailTemplates.notification({
                title: `High Priority Support Ticket: ${ticket.ticketNumber}`,
                message: `A high priority support ticket has been created and requires immediate attention.`,
                info: {
                    "Ticket Number": ticket.ticketNumber,
                    "User": `${ticket.user.name} (${ticket.user.email})`,
                    "Category": ticket.category,
                    "Priority": ticket.priority,
                    "Subject": ticket.subject || '',
                    "Created At": new Date(ticket.createdAt).toLocaleString(),
                    "Ticket URL": `${process.env.NEXT_PUBLIC_APP_URL}/admin/support/${ticket.id}`,
                },
            })

            await sendEmail({
                to: process.env.ADMIN_EMAIL!,
                subject: adminTemplate.subject,
                html: adminTemplate.html,
                highPriority: true,
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

// Broker subscription purchase/activation confirmation. One canonical owner for
// the broker product: fire-and-forget, deterministic key per broker subscription,
// never mixed with company billing data. Delivery is hardened with durable,
// concurrency-safe idempotency (lib/broker-subscription-email.ts) so the same
// successful subscription cannot trigger duplicate purchase emails across
// webhook retries, distinct events, or application instances.
export async function sendSubscriptionPurchaseEmail(brokerSubscriptionId: string) {
    const result = await sendBrokerSubscriptionPurchaseEmailDurable(brokerSubscriptionId)
    if (result.status === 'sent') return { success: true }
    if (result.status === 'skipped') return { success: true, skipped: true, reason: result.reason }
    return { success: false, error: result.error, details: result.error }
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
      <div style="font-family: Arial, Helvetica, sans-serif; padding: 20px; background-color: #ffffff;">
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
