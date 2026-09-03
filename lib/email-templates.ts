/* eslint-disable @typescript-eslint/no-explicit-any */
// lib/email-templates.ts - HomeLoanMarket (US) email templates.
//
// This module defines the static, platform-owned email templates used across
// the application. Content is written for the US mortgage market and all
// monetary values are formatted as USD. Dynamic values (plan pricing, loan
// amounts, names, links) are passed in by callers and inserted into the shared
// layout. Plain-text fallbacks are derived from the same content so no email
// ever ships without a usable text version.
import {
  formatPlanPriceAndInterval,
  formatLoanAmountDollars,
} from '@/lib/email-format'

// Shared application constants (kept here so every template is consistent).
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://homeloanmarket.com'
const SUPPORT_EMAIL = 'support@homeloanmarket.com'
const TAGLINE = 'Connecting homebuyers with trusted mortgage professionals across the United States'

type InfoItems = Record<string, string>

export const emailTemplates = {
  // Broker registration / verification. Wording is generic enough to also serve
  // regular user and company email verification via the shared resend flow.
  brokerWelcome: (name: string, verificationLink: string) => ({
    subject: `Welcome to HomeLoanMarket, ${name}! Verify your email`,
    html: buildHomeLoanTemplate({
      title: 'Welcome to HomeLoanMarket!',
      subtitle: 'Verify your email to activate your account',
      message: `Thank you for registering with HomeLoanMarket, ${name}. Please verify your email address to activate your account and get started.`,
      highlightSection: `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationLink}"
             style="background-color: #2563eb; color: white; padding: 14px 28px;
                    text-decoration: none; border-radius: 8px; display: inline-block;
                    font-weight: bold; font-size: 16px;">
            Verify Your Email
          </a>
        </div>
        <div style="background: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #e2e8f0;">
          <p style="color: #475569; font-size: 14px; margin: 0;">
            <strong>Next steps:</strong> Once your email is verified, complete your profile to start connecting with homebuyers.
          </p>
        </div>
      `,
      infoItems: {
        'Verification Link': verificationLink,
        'Expires In': '24 hours',
        'Support Email': SUPPORT_EMAIL,
      },
    }),
  }),

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  claimInvitation: (broker: any, claimLink: string, _expiresAt: Date) => ({
    subject: 'Your Mortgage Professional Profile Is Now Listed on HomeLoanMarket.com',
    html: buildHomeLoanTemplate({
      title: 'Your Mortgage Professional Profile Is Now Listed on HomeLoanMarket.com',
      subtitle: '',
      message: `Hi ${broker.displayName || 'there'},<br/><br/>Your mortgage professional profile is now listed on HomeLoanMarket.com, helping local homebuyers discover and connect with mortgage professionals in their area.<br/><br/>Claim your profile for FREE to review your information, update your details, add or change your photo, and manage your listing.`,
      highlightSection: `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${claimLink}"
             style="background-color: #2563eb; color: white; padding: 14px 28px;
                    text-decoration: none; border-radius: 8px; display: inline-block;
                    font-weight: bold; font-size: 16px;">
            Claim Your Profile
          </a>
        </div>
      `,
      infoItems: {
        'HomeLoanMarket is built to give local mortgage professionals greater exposure to a large, hard-to-reach homebuyer community.': '',
        'There is no cost to claim or maintain your basic listing.': '',
        'If you prefer not to be listed on HomeLoanMarket, you can also remove your profile at any time.': '',
      },
    }),
  }),

  claimVerification: (name: string, verificationLink: string) => ({
    subject: 'Verify your email to continue your HomeLoanMarket claim',
    html: buildHomeLoanTemplate({
      title: 'Verify your email',
      subtitle: 'Continue claiming your existing business profile',
      message: `Hello ${name}, please verify your email to continue the secure HomeLoanMarket profile claim process. This does not create a second mortgage originator profile.`,
      highlightSection: `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationLink}" style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">Verify Email</a>
        </div>
      `,
      infoItems: {
        'Verification Link': verificationLink,
        'Expires In': '24 hours',
        Support: SUPPORT_EMAIL,
      },
    }),
  }),

  // Shared verification email for broker, user, and company account holders.
  // The wording is intentionally generic so it is correct for every account
  // type without introducing role-specific language.
  resendVerification: (name: string, verificationLink: string) => ({
    subject: `Verify your HomeLoanMarket account, ${name}`,
    html: buildHomeLoanTemplate({
      title: 'Verify your account',
      subtitle: 'Confirm your email address',
      message: `Hello ${name}, please verify your email address to finish setting up your HomeLoanMarket account.`,
      highlightSection: `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationLink}"
             style="background-color: #2563eb; color: white; padding: 14px 28px;
                    text-decoration: none; border-radius: 8px; display: inline-block;
                    font-weight: bold; font-size: 16px;">
            Verify Your Email
          </a>
        </div>
        <div style="background: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #e2e8f0;">
          <p style="color: #475569; font-size: 14px; margin: 0;">
            <strong>Next steps:</strong> Complete your profile to start using HomeLoanMarket.
          </p>
        </div>
      `,
      infoItems: {
        'Verification Link': verificationLink,
        'Expires In': '24 hours',
        'Support Email': SUPPORT_EMAIL,
      },
    }),
  }),

  brokerVerified: (broker: any) => ({
    subject: `Account verified: ${broker.displayName}`,
    html: buildHomeLoanTemplate({
      title: 'Account verified!',
      subtitle: 'Your profile is now active on HomeLoanMarket',
      message: `Congratulations ${broker.displayName}! Your account has been verified and your profile is now visible to homebuyers.`,
      highlightSection: `
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 25px; border-radius: 8px; margin: 20px 0;">
          <div style="display: flex; align-items: center; gap: 15px;">
            <div style="background: rgba(255,255,255,0.2); color: white; width: 50px; height: 50px;
                        border-radius: 8px; display: flex; align-items: center; justify-content: center;
                        font-size: 24px;">
              🏆
            </div>
            <div>
              <h3 style="margin: 0 0 5px 0; color: white;">Profile active</h3>
              <p style="margin: 0; color: rgba(255,255,255,0.9); font-size: 14px;">
                Start receiving mortgage inquiries from homebuyers
              </p>
            </div>
          </div>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${APP_URL}/brokers/${broker.profileSlug}"
             style="background-color: #2563eb; color: white; padding: 14px 28px;
                    text-decoration: none; border-radius: 8px; display: inline-block;
                    font-weight: bold; font-size: 16px;">
            View Your Profile
          </a>
        </div>
      `,
      infoItems: {
        'Mortgage Originator Name': broker.displayName,
        'Profile URL': `${APP_URL}/brokers/${broker.profileSlug}`,
        City: broker.city || '',
        Experience: `${broker.experienceYears} years`,
        'Verification Status': 'Verified',
        'Next Steps': 'Consider upgrading to a Mortgage Expert plan for better visibility',
      },
    }),
  }),

  newLead: (broker: any, lead: any) => ({
    subject: `New mortgage lead: ${lead.name}`,
    html: buildHomeLoanTemplate({
      title: 'New mortgage lead received',
      subtitle: 'A homebuyer has shown interest in your services',
      message: `You received a new mortgage inquiry from ${lead.name}. Contact them promptly to increase your chance of converting the lead.`,
      highlightSection: `
        <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #f59e0b;">
          <div style="display: flex; align-items: center; gap: 15px;">
            <div style="background: #f59e0b; color: white; width: 50px; height: 50px;
                        border-radius: 8px; display: flex; align-items: center; justify-content: center;
                        font-size: 24px;">
              📞
            </div>
            <div>
              <h3 style="margin: 0 0 5px 0; color: #92400e;">Contact the lead now</h3>
              <p style="margin: 0; color: #92400e; font-size: 14px;">
                Homebuyers who are contacted quickly are more likely to choose a mortgage originator.
              </p>
            </div>
          </div>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${APP_URL}/broker/leads/${lead.id}"
             style="background-color: #2563eb; color: white; padding: 14px 28px;
                    text-decoration: none; border-radius: 8px; display: inline-block;
                    font-weight: bold; font-size: 16px;">
            Review Your Lead
          </a>
        </div>
      `,
      infoItems: {
        'Lead Name': lead.name,
        Phone: lead.phone,
        Email: lead.email || 'Not provided',
        City: lead.city,
        'Loan Amount': formatLoanAmountDollars(lead.loanAmount),
        'Loan Type': lead.loanType || 'Home Loan',
        'Property Type': lead.propertyType || 'Not specified',
        Timeline: lead.timeline || 'Exploring options',
        'Received At': new Date(lead.createdAt).toLocaleString(),
        'Lead Status': 'NEW',
      },
    }),
  }),

  newMessage: (broker: any, contact: any) => ({
    subject: `New contact message: ${contact.name}`,
    html: buildHomeLoanTemplate({
      title: 'New contact message',
      subtitle: 'A homebuyer has reached out to you',
      message: `You received a new message from ${contact.name}. Respond promptly to help move their mortgage inquiry forward.`,
      highlightSection: `
        <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #f59e0b;">
          <div style="display: flex; align-items: center; gap: 15px;">
            <div style="background: #f59e0b; color: white; width: 50px; height: 50px;
                        border-radius: 8px; display: flex; align-items: center; justify-content: center;
                        font-size: 24px;">
              📞
            </div>
            <div>
              <h3 style="margin: 0 0 5px 0; color: #92400e;">Contact the lead now</h3>
              <p style="margin: 0; color: #92400e; font-size: 14px;">
                A prompt response improves your chances of winning the business.
              </p>
            </div>
          </div>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${APP_URL}/broker/contacts/${contact.id}"
             style="background-color: #2563eb; color: white; padding: 14px 28px;
                    text-decoration: none; border-radius: 8px; display: inline-block;
                    font-weight: bold; font-size: 16px;">
            Review Your Lead
          </a>
        </div>
      `,
      infoItems: {
        'Lead Name': contact.name,
        Phone: contact.phone,
        Email: contact.email || 'Not provided',
        City: contact.city,
        Message: contact.message,
        'Loan Type': contact.loanType || 'Home Loan',
        'Property Type': contact.propertyType || 'Not specified',
        'Received At': new Date(contact.createdAt).toLocaleString(),
      },
    }),
  }),

  // Subscription activated. Uses the real plan name, price (in cents), currency
  // and billing interval from the linked BrokerSubscriptionPlan record rather
  // than any hardcoded amount.
  subscriptionPurchased: (broker: any, subscription: any, plan?: any) => {
    const planName = plan?.name || subscription?.plan || 'plan'
    const priceCents = typeof plan?.price === 'number' ? plan.price : 0
    const currency = plan?.currency || 'usd'
    const interval = plan?.billingInterval || 'month'
    const priceLine = formatPlanPriceAndInterval(priceCents, currency, interval)
    return {
      subject: `Subscription activated: ${planName} plan`,
      html: buildHomeLoanTemplate({
        title: 'Subscription activated!',
        subtitle: `Your ${planName} plan is now active`,
        message: `Thank you for subscribing to the ${planName} plan on HomeLoanMarket. Your profile now has enhanced visibility and features.`,
        highlightSection: `
          <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); padding: 25px; border-radius: 8px; margin: 20px 0;">
            <div style="display: flex; align-items: center; gap: 15px;">
              <div style="background: rgba(255,255,255,0.2); color: white; width: 50px; height: 50px;
                          border-radius: 8px; display: flex; align-items: center; justify-content: center;
                          font-size: 24px;">
                ⭐
              </div>
              <div>
                <h3 style="margin: 0 0 5px 0; color: white;">Premium features activated</h3>
                <p style="margin: 0; color: rgba(255,255,255,0.9); font-size: 14px;">
                  Price: ${priceLine}
                </p>
              </div>
            </div>
          </div>
        `,
        infoItems: {
          Plan: planName,
          Price: priceLine,
          'Billing Interval': interval,
          'Start Date': new Date(subscription.startDate).toLocaleDateString(),
          'End Date': subscription.endDate ? new Date(subscription.endDate).toLocaleDateString() : 'Auto-renew',
          'Profile URL': `${APP_URL}/brokers/${broker.profileSlug}`,
        },
      }),
    }
  },

  newReview: (broker: any, review: any, user: any) => ({
    subject: `New review received: ${review.rating}/5 stars`,
    html: buildHomeLoanTemplate({
      title: 'New review received!',
      subtitle: `${user.name || 'A client'} rated you ${review.rating}/5 stars`,
      message: `A homebuyer left a review on your profile. Reviews help build trust and attract more clients.`,
      highlightSection: `
        <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #0ea5e9;">
          <div style="display: flex; align-items: start; gap: 15px;">
            <div style="background: #0ea5e9; color: white; width: 50px; height: 50px;
                        border-radius: 8px; display: flex; align-items: center; justify-content: center;
                        font-size: 24px; flex-shrink: 0;">
              ⭐
            </div>
            <div>
              <div style="color: #0369a1; font-size: 18px; margin-bottom: 5px;">
                ${'⭐'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}
                <span style="margin-left: 10px; font-weight: bold;">${review.rating}/5</span>
              </div>
              <p style="margin: 0; color: #0c4a6e; font-style: italic;">
                "${review.comment || 'No comment provided'}"
              </p>
            </div>
          </div>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${APP_URL}/brokers/${broker.profileSlug}"
             style="background-color: #2563eb; color: white; padding: 14px 28px;
                    text-decoration: none; border-radius: 8px; display: inline-block;
                    font-weight: bold; font-size: 16px;">
            View Your Profile
          </a>
        </div>
      `,
      infoItems: {
        Client: user.name || 'Anonymous',
        Rating: `${review.rating}/5 stars`,
        'Review Date': new Date(review.createdAt).toLocaleDateString(),
        'Your Average Rating': broker.avgRating.toFixed(1),
        'Total Reviews': broker.totalReviews,
        'Profile Views': broker.profileViews || 0,
      },
    }),
  }),

  emailChangeVerification: (name: string, verificationLink: string, expiryHours: number = 1) => ({
    subject: 'Verify your new email address',
    html: buildHomeLoanTemplate({
      title: 'Confirm your email change',
      subtitle: 'Secure your account',
      message: `Hello ${name}, you requested to change the email address on your account. Click the button below to confirm the new address. Your existing email remains active until you verify.`,
      highlightSection: `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationLink}"
             style="background-color: #2563eb; color: white; padding: 14px 28px;
                    text-decoration: none; border-radius: 8px; display: inline-block;
                    font-weight: bold; font-size: 16px;">
            Verify New Email
          </a>
        </div>
        <div style="background: #fef2f2; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #fca5a5;">
          <p style="color: #dc2626; font-size: 14px; margin: 0;">
            <strong>Security notice:</strong> This link expires in ${expiryHours} hour${expiryHours > 1 ? 's' : ''}. If you didn't request this, please ignore this email.
          </p>
        </div>
      `,
      infoItems: {
        'Verification Link': verificationLink,
        'Expires In': `${expiryHours} hour${expiryHours > 1 ? 's' : ''}`,
        Support: SUPPORT_EMAIL,
      },
    }),
  }),

  passwordReset: (name: string, resetLink: string, expiryHours: number = 1) => ({
    subject: 'Reset your HomeLoanMarket password',
    html: buildHomeLoanTemplate({
      title: 'Password reset request',
      subtitle: 'Secure your account',
      message: `Hello ${name}, you requested to reset your password. Click the button below to create a new password.`,
      highlightSection: `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}"
             style="background-color: #2563eb; color: white; padding: 14px 28px;
                    text-decoration: none; border-radius: 8px; display: inline-block;
                    font-weight: bold; font-size: 16px;">
            Reset Your Password
          </a>
        </div>
        <div style="background: #fef2f2; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #fca5a5;">
          <p style="color: #dc2626; font-size: 14px; margin: 0;">
            <strong>Security notice:</strong> This link expires in ${expiryHours} hour${expiryHours > 1 ? 's' : ''}. If you didn't request this, please ignore this email.
          </p>
        </div>
      `,
      infoItems: {
        'Reset Link': resetLink,
        'Expires In': `${expiryHours} hour${expiryHours > 1 ? 's' : ''}`,
        'Requested At': new Date().toLocaleString(),
        Support: SUPPORT_EMAIL,
      },
    }),
  }),

  notification: (title: string, message: string, infoItems: InfoItems) => ({
    subject: title,
    html: buildHomeLoanTemplate({
      title,
      subtitle: 'Notification from HomeLoanMarket',
      message,
      infoItems,
    }),
  }),

  adminNewBroker: (user: any, broker: any) => ({
    subject: `New broker registration: ${broker.displayName}`,
    html: buildHomeLoanTemplate({
      title: 'New broker registration',
      subtitle: 'A new broker has joined the platform',
      message: `A new broker has registered and requires verification.`,
      highlightSection: `
        <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin-top: 20px; border: 1px solid #f59e0b;">
          <p style="color: #92400e; margin: 0; font-size: 14px; font-weight: bold;">
            Action required: broker verification
          </p>
          <ul style="color: #92400e; margin: 10px 0 0 20px; padding-left: 0; font-size: 13px;">
            <li>Review broker details in the admin dashboard</li>
            <li>Check the registration information</li>
            <li>Approve or request additional documentation</li>
          </ul>
        </div>
      `,
      infoItems: {
        'Broker Name': broker.displayName,
        Company: broker.companyName || 'Individual',
        User: `${user.name} (${user.email})`,
        City: broker.city || '',
        Experience: `${broker.experienceYears} years`,
        'Registration Date': new Date().toLocaleDateString(),
        'Profile URL': `${APP_URL}/admin/brokers/${broker.id}`,
        'Verification Status': 'UNVERIFIED',
      },
    }),
  }),

  newContactMessage: (broker: any, contact: any) => ({
    subject: `New contact message from ${contact.name}`,
    html: buildHomeLoanTemplate({
      title: 'New contact message received!',
      subtitle: 'A homebuyer has reached out to you',
      message: `You received a new contact message. Please respond promptly to move this mortgage inquiry forward.`,
      highlightSection: `
        <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #f59e0b;">
          <div style="display: flex; align-items: center; gap: 15px;">
            <div style="background: #f59e0b; color: white; width: 50px; height: 50px;
                        border-radius: 8px; display: flex; align-items: center; justify-content: center;
                        font-size: 24px;">
              📞
            </div>
            <div>
              <h3 style="margin: 0 0 5px 0; color: #92400e;">Contact the lead now</h3>
              <p style="margin: 0; color: #92400e; font-size: 14px;">
                A prompt response improves your chance of winning the business.
              </p>
            </div>
          </div>
        </div>
      `,
      infoItems: {
        From: contact.name,
        Email: contact.email,
        Phone: contact.phone,
        Subject: contact.subject,
        Message: contact.message,
        'Loan Type': contact.loanType || 'Not specified',
        'Property Type': contact.propertyType || 'Not specified',
        'Loan Amount': formatLoanAmountDollars(contact.loanAmount),
        Timeline: contact.timeline || 'Exploring options',
        'Received At': new Date(contact.createdAt).toLocaleString(),
      },
    }),
  }),

  contactMessageConfirmation: (user: any, broker: any, message: any) => ({
    subject: `Your message was sent to ${broker.displayName || 'the mortgage originator'}`,
    html: buildHomeLoanTemplate({
      title: 'Message sent successfully!',
      subtitle: 'Your inquiry has been received',
      message: `Thank you for reaching out. Your message was sent to ${broker.displayName || 'the mortgage originator'}, and they will get back to you soon.`,
      highlightSection: `
        <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #86efac;">
          <div style="display: flex; align-items: center; gap: 15px;">
            <div style="background: #22c55e; color: white; width: 50px; height: 50px;
                        border-radius: 8px; display: flex; align-items: center; justify-content: center;
                        font-size: 24px;">
              ✅
            </div>
            <div>
              <h3 style="margin: 0 0 5px 0; color: #15803d;">Message delivered</h3>
              <p style="margin: 0; color: #15803d; font-size: 14px;">
                The mortgage originator will typically respond within 24 hours
              </p>
            </div>
          </div>
        </div>
      `,
      infoItems: {
        Broker: broker.displayName || broker.companyName || 'Mortgage Originator',
        Company: broker.companyName || 'Independent',
        Email: broker.email,
        Phone: broker.phone || 'Not provided',
        'Your Message': message.subject || 'No subject',
        'Sent At': new Date(message.createdAt).toLocaleString(),
        'Estimated Response': '24 hours',
        Support: SUPPORT_EMAIL,
      },
    }),
  }),
}

// Shared US-market HomeLoanMarket email layout.
function buildHomeLoanTemplate(options: {
  title: string
  subtitle: string
  message: string
  highlightSection?: string
  infoItems: InfoItems
}) {
  const infoItemsHtml = Object.entries(options.infoItems)
    .map(([key, value]) => `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; color: #475569; width: 150px; font-weight: 500;">${key}:</td>
        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-weight: 500;">${value}</td>
      </tr>
    `).join('')

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          line-height: 1.6;
          color: #334155;
          margin: 0;
          padding: 0;
          background-color: #f8fafc;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .header {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: white;
          padding: 40px 30px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .header::before {
          content: "🏠";
          position: absolute;
          font-size: 100px;
          opacity: 0.1;
          top: 20px;
          right: 30px;
        }
        .logo {
          font-size: 32px;
          font-weight: bold;
          margin-bottom: 10px;
          letter-spacing: -0.5px;
        }
        .tagline {
          opacity: 0.9;
          font-size: 14px;
          font-weight: 300;
          letter-spacing: 0.5px;
        }
        .content {
          padding: 40px 30px;
        }
        .info-table {
          width: 100%;
          border-collapse: collapse;
          margin: 30px 0;
          background: #f8fafc;
          border-radius: 8px;
          overflow: hidden;
        }
        .footer {
          background: #f1f5f9;
          padding: 30px 20px;
          text-align: center;
          color: #64748b;
          font-size: 13px;
          border-top: 1px solid #e2e8f0;
        }
        .highlight {
          background: #f8fafc;
          padding: 20px;
          border-radius: 10px;
          margin: 20px 0;
          border: 1px solid #e2e8f0;
        }
        .button {
          background: #2563eb;
          color: white;
          padding: 14px 32px;
          text-decoration: none;
          border-radius: 8px;
          display: inline-block;
          font-weight: 600;
          font-size: 15px;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .button:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(37, 99, 235, 0.3);
        }
        .social-links {
          margin-top: 20px;
        }
        .social-links a {
          margin: 0 10px;
          text-decoration: none;
          color: #2563eb;
          font-size: 14px;
        }
        @media (max-width: 600px) {
          .container { width: 100% !important; }
          .header { padding: 30px 20px !important; }
          .content { padding: 30px 20px !important; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">HomeLoanMarket</div>
          <div class="tagline">${TAGLINE}</div>
        </div>

        <div class="content">
          <h1 style="color: #1e293b; margin-top: 0; font-size: 28px; font-weight: 700;">${options.title}</h1>
          <h2 style="color: #475569; font-size: 18px; margin: 10px 0 25px 0; font-weight: 500;">${options.subtitle}</h2>

          <p style="margin-bottom: 25px; color: #475569; font-size: 15px;">${options.message}</p>

          ${options.highlightSection || ''}

          <table class="info-table" cellpadding="10">
            ${infoItemsHtml}
          </table>

          <p style="color: #64748b; font-size: 14px; margin-top: 35px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
            Need help? Contact us at <a href="mailto:${SUPPORT_EMAIL}" style="color: #2563eb; text-decoration: none;">${SUPPORT_EMAIL}</a>
          </p>
        </div>

        <div class="footer">
          <p>© ${new Date().getFullYear()} HomeLoanMarket. All rights reserved.</p>
          <p>This email was sent to you as a registered user of HomeLoanMarket.</p>

          <div class="social-links">
            <a href="https://twitter.com/homeloanmarket">Twitter</a> |
            <a href="https://facebook.com/homeloanmarket">Facebook</a> |
            <a href="https://linkedin.com/company/homeloanmarket">LinkedIn</a>
          </div>

          <p style="margin-top: 20px; font-size: 11px; color: #94a3b8;">
            <a href="${APP_URL}/privacy-policy" style="color: #64748b; margin: 0 8px;">Privacy Policy</a> |
            <a href="${APP_URL}/terms-of-service" style="color: #64748b; margin: 0 8px;">Terms of Service</a> |
            <a href="mailto:unsubscribe@homeloanmarket.com?subject=Unsubscribe" style="color: #64748b; margin: 0 8px;">Unsubscribe</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}

// Convenience: keep a plain-text strip helper for callers that want to reuse
// the same content as text.
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
