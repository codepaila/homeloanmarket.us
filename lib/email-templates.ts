// lib/email-templates.ts - HomeLoanMarket (US) transactional email templates.
//
// Every template renders through the single shared email shell
// (lib/email-shell.ts) so all emails share one visual identity, one header, one
// footer, one CTA style, and email-safe markup. User-controlled data is escaped
// via lib/email-utils.ts before interpolation. Templates return a uniform
// contract: { subject, preheader, html }.
import { renderEmailShell } from '@/lib/email-shell'
import { escapeHtml } from '@/lib/email-utils'
import { formatPlanPriceAndInterval, formatLoanAmountDollars } from '@/lib/email-format'

// ---------------------------------------------------------------------------
// Typed data contracts (explicit; never pass raw Prisma objects when only a few
// fields are needed)
// ---------------------------------------------------------------------------

export type BrokerVerifiedEmailData = {
  displayName: string
  profileUrl: string
  dashboardUrl: string
  city?: string | null
  experienceYears?: number | null
}

export type SubscriptionPurchaseEmailData = {
  brokerName: string
  planName: string
  priceCents: number
  currency: string
  interval: string
  startDate: Date
  endDate?: Date | null
  dashboardUrl: string
}

export type PasswordResetEmailData = {
  name: string
  resetLink: string
  expiryHours: number
}

export type ClaimInvitationEmailData = {
  displayName: string
  claimLink: string
}

export type PlatformContactEmailData = {
  name: string
  email: string
  phone?: string
  subject?: string
  message: string
}

export type ContactMessageConfirmationEmailData = {
  recipientName: string
  brokerName: string
  companyName?: string | null
  messageSubject?: string
  sentAt: Date
}

export type NewContactMessageEmailData = {
  contactName: string
  contactEmail?: string
  contactPhone?: string
  contactMessage?: string
  loanType?: string
  propertyType?: string
  loanAmount?: string | number | null
  receivedAt: Date
  reviewUrl: string
}

export type AdminNewBrokerEmailData = {
  brokerDisplayName: string
  brokerCompanyName?: string | null
  brokerCity?: string | null
  brokerExperienceYears?: number
  userEmail: string
  adminUrl: string
}

export type NotificationEmailData = {
  title: string
  message: string
  info: Record<string, string>
}

export type EmailTemplateResult = {
  subject: string
  preheader: string
  html: string
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export const emailTemplates = {
  // Broker/user/company email verification (registration + resend).
  brokerWelcome: (name: string, verificationLink: string): EmailTemplateResult => ({
    subject: `Welcome to HomeLoanMarket, ${escapeHtml(name)}! Verify your email`,
    preheader: 'Please verify your email address to activate your HomeLoanMarket account.',
    html: renderEmailShell({
      preheader: 'Please verify your email address to activate your HomeLoanMarket account.',
      title: 'Welcome to HomeLoanMarket',
      subtitle: 'Verify your email to activate your account',
      message: `Thank you for registering, ${name}. Please verify your email address to activate your account and get started.`,
      ctaLabel: 'Verify Your Email',
      ctaHref: verificationLink,
      info: { 'Verification Link': verificationLink, 'Expires In': '24 hours' },
    }),
  }),

  claimInvitation: (data: ClaimInvitationEmailData): EmailTemplateResult => ({
    subject: 'Your Mortgage Professional Profile Is Now Listed on HomeLoanMarket.com',
    preheader: 'Claim your free mortgage originator profile on HomeLoanMarket.',
    html: renderEmailShell({
      preheader: 'Claim your free mortgage originator profile on HomeLoanMarket.',
      title: 'Your Mortgage Professional Profile Is Now Listed on HomeLoanMarket.com',
      message: `Hi ${data.displayName || 'there'},\n\nYour mortgage professional profile is now listed on HomeLoanMarket.com, helping local homebuyers discover and connect with mortgage professionals in their area.\n\nClaim your profile for FREE to review your information, update your details, add or change your photo, and manage your listing.\n\nClaim Your Profile:\n${data.claimLink}\n\nHomeLoanMarket is built to give local mortgage professionals greater exposure to a large, hard-to-reach homebuyer community.\n\nThere is no cost to claim or maintain your basic listing.\n\nIf you prefer not to be listed on HomeLoanMarket, you can also remove your profile at any time.\n\nBest,\nHomeLoanMarket Team\nHomeLoanMarket.com`,
      ctaLabel: 'Claim Your Profile',
      ctaHref: data.claimLink,
    }),
  }),

  claimVerification: (name: string, verificationLink: string): EmailTemplateResult => ({
    subject: 'Verify your email to continue your HomeLoanMarket claim',
    preheader: 'Confirm your email to continue claiming your existing business profile.',
    html: renderEmailShell({
      preheader: 'Confirm your email to continue claiming your existing business profile.',
      title: 'Verify your email',
      subtitle: 'Continue claiming your existing business profile',
      message: `Hello ${name}, please verify your email to continue the secure HomeLoanMarket profile claim process. This does not create a second mortgage originator profile.`,
      ctaLabel: 'Verify Email',
      ctaHref: verificationLink,
      info: { 'Expires In': '24 hours' },
    }),
  }),

  resendVerification: (name: string, verificationLink: string): EmailTemplateResult => ({
    subject: `Verify your HomeLoanMarket account, ${escapeHtml(name)}`,
    preheader: 'Confirm your email address to finish setting up your HomeLoanMarket account.',
    html: renderEmailShell({
      preheader: 'Confirm your email address to finish setting up your HomeLoanMarket account.',
      title: 'Verify your account',
      subtitle: 'Confirm your email address',
      message: `Hello ${name}, please verify your email address to finish setting up your HomeLoanMarket account.`,
      ctaLabel: 'Verify Your Email',
      ctaHref: verificationLink,
      info: { 'Expires In': '24 hours' },
    }),
  }),

  brokerVerified: (data: BrokerVerifiedEmailData): EmailTemplateResult => ({
    subject: 'Your HomeLoanMarket broker account is verified',
    preheader: 'Your broker account has been verified and can now appear in the public directory.',
    html: renderEmailShell({
      preheader: 'Your broker account has been verified and can now appear in the public directory.',
      title: 'Your broker account is verified',
      message: `Hi ${data.displayName},\n\nYour broker account has been successfully verified by our team. Your profile can now appear in the public broker directory when your profile is set to visible.`,
      status: { tone: 'success', label: 'Status: Verified' },
      ctaLabel: 'Go to Dashboard',
      ctaHref: data.dashboardUrl,
      info: {
        ...(data.city ? { City: data.city } : {}),
        ...(data.experienceYears != null ? { Experience: `${data.experienceYears} years` } : {}),
      },
    }),
  }),

  // Buyer → broker contact notification (active product flow; migrated to shell).
  newContactMessage: (data: NewContactMessageEmailData): EmailTemplateResult => ({
    subject: `New contact message from ${escapeHtml(data.contactName)}`,
    preheader: 'A homebuyer has reached out to you on HomeLoanMarket.',
    html: renderEmailShell({
      preheader: 'A homebuyer has reached out to you on HomeLoanMarket.',
      title: 'New contact message',
      subtitle: 'A homebuyer has reached out to you',
      message: `You received a new message from ${data.contactName}. Respond promptly to help move their mortgage inquiry forward.`,
      ctaLabel: 'Review Your Lead',
      ctaHref: data.reviewUrl,
      info: {
        'Contact Name': data.contactName,
        Phone: data.contactPhone || 'Not provided',
        Email: data.contactEmail || 'Not provided',
        ...(data.contactMessage ? { Message: data.contactMessage } : {}),
        'Loan Type': data.loanType || 'Not specified',
        'Property Type': data.propertyType || 'Not specified',
        'Loan Amount': formatLoanAmountDollars(data.loanAmount),
        'Received At': new Date(data.receivedAt).toLocaleString(),
      },
    }),
  }),

  contactMessageConfirmation: (data: ContactMessageConfirmationEmailData): EmailTemplateResult => ({
    subject: `Your message was sent to ${escapeHtml(data.brokerName)}`,
    preheader: 'Your message has been sent on HomeLoanMarket.',
    html: renderEmailShell({
      preheader: 'Your message has been sent on HomeLoanMarket.',
      title: 'Message sent successfully',
      subtitle: 'Your inquiry has been received',
      message: `Thank you for reaching out, ${data.recipientName || 'there'}. Your message was sent to ${data.brokerName}, and they will get back to you soon.`,
      status: { tone: 'success', label: 'Status: Message delivered' },
      info: {
        Broker: data.brokerName,
        ...(data.companyName ? { Company: data.companyName } : {}),
        ...(data.messageSubject ? { Subject: data.messageSubject } : {}),
        'Sent At': new Date(data.sentAt).toLocaleString(),
        'Estimated Response': '24 hours',
      },
    }),
  }),

  emailChangeVerification: (name: string, verificationLink: string, expiryHours = 1): EmailTemplateResult => ({
    subject: 'Verify your new email address',
    preheader: 'Confirm your new HomeLoanMarket email address.',
    html: renderEmailShell({
      preheader: 'Confirm your new HomeLoanMarket email address.',
      title: 'Confirm your email change',
      subtitle: 'Secure your account',
      message: `Hello ${name}, you requested to change the email address on your account. Click the button below to confirm the new address. Your existing email remains active until you verify.`,
      ctaLabel: 'Verify New Email',
      ctaHref: verificationLink,
      status: { tone: 'warning', label: `This link expires in ${expiryHours} hour${expiryHours > 1 ? 's' : ''}` },
      info: { 'Expires In': `${expiryHours} hour${expiryHours > 1 ? 's' : ''}` },
    }),
  }),

  passwordReset: (data: PasswordResetEmailData): EmailTemplateResult => ({
    subject: 'Reset your HomeLoanMarket password',
    preheader: 'Create a new password for your HomeLoanMarket account.',
    html: renderEmailShell({
      preheader: 'Create a new password for your HomeLoanMarket account.',
      title: 'Password reset request',
      subtitle: 'Secure your account',
      message: `Hello ${data.name}, you requested to reset your password. Click the button below to create a new password.`,
      ctaLabel: 'Reset Your Password',
      ctaHref: data.resetLink,
      status: { tone: 'warning', label: `This link expires in ${data.expiryHours} hour${data.expiryHours > 1 ? 's' : ''}` },
      info: { 'Expires In': `${data.expiryHours} hour${data.expiryHours > 1 ? 's' : ''}` },
    }),
  }),

  // Generic notification (support tickets, admin alerts).
  notification: (data: NotificationEmailData): EmailTemplateResult => ({
    subject: data.title,
    preheader: data.message.slice(0, 120),
    html: renderEmailShell({
      preheader: data.message.slice(0, 120),
      title: data.title,
      message: data.message,
      info: data.info,
    }),
  }),

  adminNewBroker: (data: AdminNewBrokerEmailData): EmailTemplateResult => ({
    subject: `New broker registration: ${escapeHtml(data.brokerDisplayName)}`,
    preheader: 'A new mortgage originator has registered and requires verification.',
    html: renderEmailShell({
      preheader: 'A new mortgage originator has registered and requires verification.',
      title: 'New broker registration',
      subtitle: 'A new mortgage originator has joined the platform',
      message: 'A new mortgage originator has registered and requires verification.',
      status: { tone: 'warning', label: 'Action required: broker verification' },
      ctaLabel: 'Review Broker',
      ctaHref: data.adminUrl,
      info: {
        'Broker Name': data.brokerDisplayName,
        Company: data.brokerCompanyName || 'Individual',
        User: data.userEmail,
        ...(data.brokerCity ? { City: data.brokerCity } : {}),
        ...(data.brokerExperienceYears != null ? { Experience: `${data.brokerExperienceYears} years` } : {}),
        'Registration Date': new Date().toLocaleDateString(),
        'Verification Status': 'UNVERIFIED',
      },
    }),
  }),

  // Subscription purchase/activation confirmation. Uses the authoritative plan
  // price/interval from the linked BrokerSubscriptionPlan record.
  subscriptionPurchased: (data: SubscriptionPurchaseEmailData): EmailTemplateResult => {
    const priceLine = formatPlanPriceAndInterval(data.priceCents, data.currency, data.interval)
    return {
      subject: `Your HomeLoanMarket ${data.planName} subscription is active`,
      preheader: `Your ${data.planName} subscription is now active.`,
      html: renderEmailShell({
        preheader: `Your ${data.planName} subscription is now active.`,
        title: 'Your subscription is active',
        subtitle: `${data.planName} plan`,
        message: `Hello ${data.brokerName},\n\nYour ${data.planName} subscription is now active.`,
        status: { tone: 'success', label: 'Status: Active' },
        ctaLabel: 'Go to Dashboard',
        ctaHref: data.dashboardUrl,
        info: {
          Plan: data.planName,
          Status: 'Active',
          Amount: priceLine,
          'Billing Cycle': data.interval,
          'Start Date': new Date(data.startDate).toLocaleDateString(),
          ...(data.endDate ? { 'Renews On': new Date(data.endDate).toLocaleDateString() } : {}),
        },
      }),
    }
  },
}

// Plain-text fallback derived from the HTML (kept as the canonical text source).
export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}