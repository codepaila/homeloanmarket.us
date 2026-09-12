'use server'

import { sendEmail, emailTemplates } from '@/lib/email'
import prisma from '@/lib/prisma'
import crypto from 'crypto'
import { sendBrokerSubscriptionPurchaseEmailDurable } from '@/lib/broker-subscription-email'
import { sendCompanySubscriptionPurchaseEmailDurable } from '@/lib/company-subscription-email'
import { sendBrokerPaymentFailureEmailDurable } from '@/lib/broker-payment-failure-email'
import { sendCompanyPaymentFailureEmailDurable } from '@/lib/company-payment-failure-email'
import { platformConfig } from '@/lib/platform-config'

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

        const appUrl = platformConfig.appUrl
        const verifyUrl = `${appUrl}/auth/verify-email?token=${rawToken}&email=${encodeURIComponent(user.email || '')}`

        const idempotencyKey = `broker_registration_${user.id}`

        // 1. Send verification email to broker
        const brokerTemplate = emailTemplates.brokerWelcome(
            user.name || 'there',
            verifyUrl
        )

        const brokerEmailResult = await sendEmail({
            to: user.email!,
            subject: brokerTemplate.subject,
            html: brokerTemplate.html,
            text: `Verify your HomeLoanMarket email: ${verifyUrl}`,
            idempotencyKey: `${idempotencyKey}_broker`
        })

        // The broker verification email is the critical delivery. The admin
        // "new broker" notification never fires from here: a Broker profile does
        // NOT exist at registration time (it is created later by
        // finalizeBrokerRegistration), so dispatching it here would be dead code.
        // sendAdminNewBrokerNotification is wired to the broker-created moment.
        return {
            success: brokerEmailResult.success,
            ...(brokerEmailResult.success ? {} : {
                error: 'Failed to send verification email',
                details: brokerEmailResult.error,
            }),
            brokerEmail: brokerEmailResult
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

// Admin notification for a NEW self-registered broker. Sent at the
// broker-created moment (after finalizeBrokerRegistration succeeds, via the
// wizard POST /api/brokers or the subscription success page) — the Broker
// profile does not exist when registration emails run. Fire-and-forget: an
// email failure never rolls back the already-created Broker.
export async function sendAdminNewBrokerNotification(brokerId: string) {
    try {
        const broker = await prisma.broker.findUnique({
            where: { id: brokerId },
            select: {
                id: true,
                displayName: true,
                companyName: true,
                city: true,
                experienceYears: true,
                user: { select: { email: true } },
            },
        })

        if (!broker) {
            throw new Error('Broker not found')
        }

        if (platformConfig.adminEmails.length === 0) {
            console.warn('No ADMIN_EMAILS configured; skipping admin new-broker notification', { brokerId })
            return { success: true, skipped: true, reason: 'No admin email recipients configured' }
        }

        const adminTemplate = emailTemplates.adminNewBroker({
            brokerDisplayName: broker.displayName,
            brokerCompanyName: broker.companyName,
            brokerCity: broker.city,
            brokerExperienceYears: broker.experienceYears ?? undefined,
            userEmail: broker.user?.email || '',
            adminUrl: `${platformConfig.appUrl}/admin/brokers/${broker.id}`,
        })

        return await sendEmail({
            to: platformConfig.adminEmails,
            subject: adminTemplate.subject,
            html: adminTemplate.html,
            idempotencyKey: `admin_new_broker_${broker.id}`,
        })
    } catch (error) {
        console.error('Error sending admin new-broker notification:', error)
        return { success: false, error: 'Failed to send admin new-broker notification' }
    }
}

// Admin notification for a NEW company registration (PENDING company shell
// established via the company-intent flow). Informational only — companies are
// not reviewed before activation. Fire-and-forget: a failure never rolls back
// the created company. Idempotency is scoped per company (deterministic), so a
// repeated/intentional PUT convergence cannot spam admins.
export async function sendAdminNewCompanyNotification(companyId: string) {
    try {
        if (platformConfig.adminEmails.length === 0) {
            console.warn('No ADMIN_EMAILS configured; skipping admin new-company notification', { companyId })
            return { success: true, skipped: true, reason: 'No admin email recipients configured' }
        }

        const company = await prisma.company.findUnique({
            where: { id: companyId },
            select: {
                id: true,
                name: true,
                createdAt: true,
                memberships: {
                    where: { role: 'OWNER', isActive: true },
                    select: { user: { select: { name: true, email: true } } },
                },
            },
        })

        if (!company) {
            throw new Error('Company not found')
        }

        const owner = company.memberships[0]?.user

        const adminTemplate = emailTemplates.adminNewCompany({
            companyName: company.name,
            ownerName: owner?.name || 'Company Owner',
            ownerEmail: owner?.email || '',
            companyId: company.id,
            adminUrl: `${platformConfig.appUrl}/admin/companies`,
            registeredAt: company.createdAt,
        })

        return await sendEmail({
            to: platformConfig.adminEmails,
            subject: adminTemplate.subject,
            html: adminTemplate.html,
            idempotencyKey: `admin_new_company_${company.id}`,
        })
    } catch (error) {
        console.error('Error sending admin new-company notification:', error)
        return { success: false, error: 'Failed to send admin new-company notification' }
    }
}

// Admin notification for a successfully claimed admin-created broker profile.
// Triggered ONLY after the claim transaction commits. Fire-and-forget: a failure
// never affects the (already successful) claim. Idempotency is scoped per
// broker (deterministic), so a retry of the completion handler cannot spam
// admins. Never contains tokens, credentials, or billing secrets.
export async function sendAdminBrokerClaimedNotification(brokerId: string) {
    try {
        const broker = await prisma.broker.findUnique({
            where: { id: brokerId },
            select: {
                id: true,
                displayName: true,
                companyName: true,
                email: true,
                city: true,
                profileSlug: true,
                user: { select: { email: true } },
                claim: { select: { completedAt: true } },
            },
        })

        if (!broker) {
            throw new Error('Broker not found')
        }

        if (platformConfig.adminEmails.length === 0) {
            console.warn('No ADMIN_EMAILS configured; skipping admin broker-claimed notification', { brokerId })
            return { success: true, skipped: true, reason: 'No admin email recipients configured' }
        }

        const template = emailTemplates.adminBrokerClaimed({
            brokerDisplayName: broker.displayName,
            brokerCompanyName: broker.companyName,
            brokerEmail: broker.email || broker.user?.email || null,
            brokerCity: broker.city,
            profileSlug: broker.profileSlug,
            claimedAt: broker.claim?.completedAt ?? new Date(),
            adminUrl: `${platformConfig.appUrl}/admin/brokers/${broker.id}`,
        })

        return await sendEmail({
            to: platformConfig.adminEmails,
            subject: template.subject,
            html: template.html,
            idempotencyKey: `admin_broker_claimed_${broker.id}`,
        })
    } catch (error) {
        console.error('Error sending admin broker-claimed notification:', error)
        return { success: false, error: 'Failed to send admin broker-claimed notification' }
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

        const appUrl = platformConfig.appUrl
        const verificationLink = `${appUrl}/auth/verify-email?token=${rawToken}&email=${encodeURIComponent(user.email)}`
        const template = emailTemplates.claimVerification(user.name || 'there', verificationLink)
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
    const appUrl = platformConfig.appUrl
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

    const appUrl = platformConfig.appUrl
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

        const appUrl = platformConfig.appUrl
        const verifyUrl = `${appUrl}/auth/verify-email?token=${rawToken}&email=${encodeURIComponent(broker.user.email)}`

        const idempotencyKey = `resend_verification_${broker.id}_${hashedToken}`

        // Send verification email
        const verificationTemplate = emailTemplates.resendVerification(
            broker.user.name || 'there',
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

        const appUrl = platformConfig.appUrl
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
        if ((ticket.priority === 'high' || ticket.priority === 'urgent') && platformConfig.adminEmails.length > 0) {
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
                    "Ticket URL": `${platformConfig.appUrl}/admin/support/${ticket.id}`,
                },
            })

            await sendEmail({
                to: platformConfig.adminEmails,
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

// Account deletion confirmation. Fire-and-forget after a successful self-service
// deletion. The recipient email and name are captured BEFORE the destructive
// transaction and passed in by the caller — the DB user record may no longer
// exist when this function runs.
export async function sendAccountDeletionConfirmationEmail(params: {
    email: string
    name: string
    accountType: 'User' | 'Broker' | 'Company'
}) {
    try {
        const template = emailTemplates.accountDeletionConfirmation({
            name: params.name,
            accountType: params.accountType,
            deletedAt: new Date(),
        })
        return await sendEmail({
            to: params.email,
            subject: template.subject,
            html: template.html,
            text: `Your HomeLoanMarket ${params.accountType} account has been permanently deleted.`,
            idempotencyKey: `account_deleted_${params.email}_${params.accountType.toLowerCase()}`,
        })
    } catch (error) {
        console.error('Failed to send account deletion confirmation email:', error)
        return { success: false, error: 'Failed to send deletion confirmation email' }
    }
}

// Admin account-deletion notification. Sent AFTER a successful deletion (the
// transaction already committed) so every configured ADMIN_EMAILS recipient is
// aware of the lifecycle event. Fire-and-forget: a failure never rolls back the
// completed deletion. All fields are captured BEFORE deletion by the caller and
// passed in — the user record may no longer exist. Never includes credentials,
// tokens, Stripe keys, or session data. Deterministic in-memory idempotency key
// (same account, same minute → suppressed).
export async function sendAdminAccountDeletionNotification(params: {
    email: string
    name: string
    accountType: 'User' | 'Broker' | 'Company'
    companyName?: string | null
    deletedBy: 'USER' | 'ADMIN'
}) {
    try {
        if (platformConfig.adminEmails.length === 0) {
            console.warn('No ADMIN_EMAILS configured; skipping admin account-deletion notification', { accountType: params.accountType })
            return { success: true, skipped: true, reason: 'No admin email recipients configured' }
        }

        const template = emailTemplates.adminAccountDeletion({
            accountType: params.accountType,
            deletedUserEmail: params.email,
            deletedUserName: params.name,
            companyName: params.companyName ?? null,
            deletedBy: params.deletedBy,
            deletedAt: new Date(),
        })

        return await sendEmail({
            to: platformConfig.adminEmails,
            subject: template.subject,
            html: template.html,
            idempotencyKey: `admin_account_deleted_${params.email}_${params.accountType.toLowerCase()}`,
        })
    } catch (error) {
        console.error('Failed to send admin account-deletion notification:', error)
        return { success: false, error: 'Failed to send admin account-deletion notification' }
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

// Company subscription purchase/activation confirmation. Fire-and-forget with
// durable, concurrency-safe idempotency (lib/company-subscription-email.ts)
// mirroring the broker subscription email pattern. Company billing remains
// completely isolated from broker billing. stripeSubscriptionId (the
// authoritative Stripe `Subscription.id`) scopes the durable activation
// idempotency so a genuinely new Stripe subscription activation after a cancel/
// re-subscribe produces a NEW activation email while replays of the same
// subscription stay suppressed.
export async function sendCompanySubscriptionPurchaseEmail(companySubscriptionId: string, stripeSubscriptionId?: string | null) {
  const result = await sendCompanySubscriptionPurchaseEmailDurable(companySubscriptionId, stripeSubscriptionId)
  if (result.status === 'sent') return { success: true }
  if (result.status === 'skipped') return { success: true, skipped: true, reason: result.reason }
  return { success: false, error: result.error, details: result.error }
}

// Broker subscription payment-failure notification. Canonical action boundary
// for the invoice.payment_failed webhook path: thin wrapper over the existing
// durable sender (lib/broker-payment-failure-email.ts). Idempotency is owned
// by the durable log (subscription + invoice); delivery can never affect
// billing state.
export async function sendBrokerPaymentFailureEmail(brokerSubscriptionId: string, invoiceId: string) {
    const result = await sendBrokerPaymentFailureEmailDurable(brokerSubscriptionId, invoiceId)
    if (result.status === 'sent') return { success: true }
    if (result.status === 'skipped') return { success: true, skipped: true, reason: result.reason }
    return { success: false, error: result.error, details: result.error }
}

// Company subscription payment-failure notification. Canonical action boundary
// mirroring the broker wrapper. Company billing remains completely isolated
// from broker billing; recipient resolution stays inside the durable sender
// (active OWNER membership only).
export async function sendCompanyPaymentFailureEmail(companySubscriptionId: string, invoiceId: string) {
    const result = await sendCompanyPaymentFailureEmailDurable(companySubscriptionId, invoiceId)
    if (result.status === 'sent') return { success: true }
    if (result.status === 'skipped') return { success: true, skipped: true, reason: result.reason }
    return { success: false, error: result.error, details: result.error }
}

// Debug email delivery
export async function debugEmailDelivery(email: string) {
    console.log('🔍 Email Delivery Debug:')
    console.log('1. App URL:', platformConfig.appUrl)
    console.log('2. From Address:', platformConfig.emailFrom)
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
        <p>From: ${platformConfig.emailFrom}</p>
      </div>
    `,
        text: 'HomeLoanMarket Test Email - If you can see this, email delivery is working!'
    }

    return await sendEmail(testEmail)
}
