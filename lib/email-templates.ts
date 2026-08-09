/* eslint-disable @typescript-eslint/no-explicit-any */
// lib/email-templates.ts - HomeLoanMarket Version
export const emailTemplates = {
  // Broker Registration
  brokerWelcome: (name: string, verificationLink: string) => ({
    subject: `🏠 Welcome to HomeLoanMarket, ${name}! Verify Your  Account`,
    html: buildHomeLoanTemplate({
      title: "Welcome to HomeLoanMarket!",
      subtitle: "Connect with home loan seekers across India",
      message: `Thank you for registering as a broker, ${name}. Verify your email to start showcasing your profile to potential clients.`,
      highlightSection: `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationLink}" 
             style="background-color: #2563eb; color: white; padding: 14px 28px; 
                    text-decoration: none; border-radius: 8px; display: inline-block;
                    font-weight: bold; font-size: 16px;">
            Verify Broker Account
          </a>
        </div>
        <div style="background: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #e2e8f0;">
          <p style="color: #475569; font-size: 14px; margin: 0;">
            <strong>💡 Next Steps:</strong> Complete your broker profile setup to start receiving leads
          </p>
        </div>
      `,
      infoItems: {
        "Verification Link": verificationLink,
        "Expires In": "24 hours",
        "Setup Required": "Complete broker profile after verification",
        "Support Email": "support@homeloanmarket.com"
      }
    })
  }),
  claimInvitation: (broker: any, claimLink: string, expiresAt: Date) => ({
    subject: `Claim your HomeLoanMarket profile: ${broker.companyName || broker.displayName}`,
    html: buildHomeLoanTemplate({
      title: "Claim your HomeLoanMarket profile",
      subtitle: "Your business profile is ready to be managed",
      message: `HomeLoanMarket created a broker profile for ${broker.companyName || broker.displayName}. If you are authorized to represent this business, use the secure link below to begin the claim process.`,
      highlightSection: `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${claimLink}"
             style="background-color: #2563eb; color: white; padding: 14px 28px;
                    text-decoration: none; border-radius: 8px; display: inline-block;
                    font-weight: bold; font-size: 16px;">
            Review and Claim Profile
          </a>
        </div>
        <div style="background: #fef2f2; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #fca5a5;">
          <p style="color: #991b1b; font-size: 14px; margin: 0;">
            This secure link expires on ${expiresAt.toLocaleString()}. HomeLoanMarket will never email you a password.
          </p>
        </div>
      `,
      infoItems: {
        "Business": broker.companyName || broker.displayName,
        "Profile URL": `${process.env.NEXT_PUBLIC_APP_URL || ''}/brokers/${broker.profileSlug}`,
        "Claim Link": claimLink,
        "Expires At": expiresAt.toLocaleString(),
        "Support": "support@homeloanmarket.com",
      },
    }),
  }),
  claimVerification: (name: string, verificationLink: string) => ({
    subject: 'Verify your email to continue your HomeLoanMarket claim',
    html: buildHomeLoanTemplate({
      title: 'Verify your email',
      subtitle: 'Continue claiming your existing business profile',
      message: `Hello ${name}, verify your email to continue the secure HomeLoanMarket profile claim process. This does not create a second broker profile.`,
      highlightSection: `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationLink}" style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">Verify Email</a>
        </div>
      `,
      infoItems: {
        "Verification Link": verificationLink,
        "Expires In": "24 hours",
        "Support": "support@homeloanmarket.com",
      },
    }),
  }),
  resendVerification: (name: string, verificationLink: string) => ({
    subject: `Verify Your  Account`,
    html: buildHomeLoanTemplate({
      title: " Verify Your  Account",
      subtitle: "Connect with home loan seekers across India",
      message: `Thank you for registering, ${name}. Verify your email to start showcasing your profile to potential clients.`,
      highlightSection: `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationLink}" 
             style="background-color: #2563eb; color: white; padding: 14px 28px; 
                    text-decoration: none; border-radius: 8px; display: inline-block;
                    font-weight: bold; font-size: 16px;">
            Verify your Account
          </a>
        </div>
        <div style="background: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #e2e8f0;">
          <p style="color: #475569; font-size: 14px; margin: 0;">
            <strong>💡 Next Steps:</strong> Complete your  profile setup to start receiving leads
          </p>
        </div>
      `,
      infoItems: {
        "Verification Link": verificationLink,
        "Expires In": "24 hours",
        // "Setup Required": "Complete  profile after verification",
        "Support Email": "support@homeloanmarket.com"
      }
    })
  }),
  // Broker Verification Approved
  brokerVerified: (broker: any) => ({
    subject: `✅  Account Verified: ${broker.displayName}`,
    html: buildHomeLoanTemplate({
      title: " Account Verified!",
      subtitle: "Your profile is now active on HomeLoanMarket",
      message: `Congratulations ${broker.displayName}! Your  account has been verified and is now visible to potential clients.`,
      highlightSection: `
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 25px; border-radius: 8px; margin: 20px 0;">
          <div style="display: flex; align-items: center; gap: 15px;">
            <div style="background: rgba(255,255,255,0.2); color: white; width: 50px; height: 50px; 
                        border-radius: 8px; display: flex; align-items: center; justify-content: center; 
                        font-size: 24px;">
              🏆
            </div>
            <div>
              <h3 style="margin: 0 0 5px 0; color: white;">Profile Active!</h3>
              <p style="margin: 0; color: rgba(255,255,255,0.9); font-size: 14px;">
                Start receiving loan inquiries from clients
              </p>
            </div>
          </div>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/brokers/${broker.profileSlug}" 
             style="background-color: #2563eb; color: white; padding: 14px 28px; 
                    text-decoration: none; border-radius: 8px; display: inline-block;
                    font-weight: bold; font-size: 16px;">
            View Your Profile
          </a>
        </div>
      `,
      infoItems: {
        "Broker Name": broker.displayName,
        "Profile URL": `${process.env.NEXT_PUBLIC_APP_URL}/brokers/${broker.profileSlug}`,
        "City": broker.city,
        "Experience": `${broker.experienceYears} years`,
        "Specializations": broker.specializations.join(', '),
        "Verification Status": "Verified",
        "Next Steps": "Consider upgrading to Featured plan for better visibility"
      }
    })
  }),

  // New Lead Notification to Broker

  newLead: (broker: any, lead: any) => ({
    subject: `🎯 New Lead Received: ${lead.name} - ${lead.loanType || 'Home Loan'}`,
    html: buildHomeLoanTemplate({
      title: "New Lead Alert!",
      subtitle: "A potential client has shown interest",
      message: `You have received a new lead. Contact them promptly to increase conversion chances.`,
      highlightSection: `
        <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #f59e0b;">
          <div style="display: flex; align-items: center; gap: 15px;">
            <div style="background: #f59e0b; color: white; width: 50px; height: 50px; 
                        border-radius: 8px; display: flex; align-items: center; justify-content: center; 
                        font-size: 24px;">
              📞
            </div>
            <div>
              <h3 style="margin: 0 0 5px 0; color: #92400e;">Contact Lead Now</h3>
              <p style="margin: 0; color: #92400e; font-size: 14px;">
                Early contact increases conversion by 300%
              </p>
            </div>
          </div>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/broker/leads/${lead.id}" 
             style="background-color: #2563eb; color: white; padding: 14px 28px; 
                    text-decoration: none; border-radius: 8px; display: inline-block;
                    font-weight: bold; font-size: 16px;">
            View Lead Details
          </a>
        </div>
      `,
      infoItems: {
        "Lead Name": lead.name,
        "Phone": lead.phone,
        "Email": lead.email || "Not provided",
        "City": lead.city,
        "Loan Amount": lead.loanAmount ? `₹${lead.loanAmount.toLocaleString()}` : "Not specified",
        "Loan Type": lead.loanType || "Home Loan",
        "Property Type": lead.propertyType || "Not specified",
        "Timeline": lead.timeline || "Exploring options",
        "Received At": new Date(lead.createdAt).toLocaleString(),
        "Lead Status": "NEW"
      }
    })
  }),
  newMessage: (broker: any, contact: any) => ({
    subject: `🎯 New Lead Received: ${contact.name} - ${contact.loanType || 'Home Loan'}`,
    html: buildHomeLoanTemplate({
      title: "New Contact Alert!",
      subtitle: "A potential client has shown interest",
      message: `You have received a new message. Contact them promptly to increase conversion chances.`,
      highlightSection: `
        <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #f59e0b;">
          <div style="display: flex; align-items: center; gap: 15px;">
            <div style="background: #f59e0b; color: white; width: 50px; height: 50px; 
                        border-radius: 8px; display: flex; align-items: center; justify-content: center; 
                        font-size: 24px;">
              📞
            </div>
            <div>
              <h3 style="margin: 0 0 5px 0; color: #92400e;">Contact Lead Now</h3>
              <p style="margin: 0; color: #92400e; font-size: 14px;">
                Early contact increases conversion by 300%
              </p>
            </div>
          </div>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/broker/contacts/${contact.id}" 
             style="background-color: #2563eb; color: white; padding: 14px 28px; 
                    text-decoration: none; border-radius: 8px; display: inline-block;
                    font-weight: bold; font-size: 16px;">
            View Lead Details
          </a>
        </div>
      `,
      infoItems: {
        "Lead Name": contact.name,
        "Phone": contact.phone,
        "Email": contact.email || "Not provided",
        "City": contact.city,
        "Message": contact.message,
        "Loan Type": contact.loanType || "Home Loan",
        "Property Type": contact.propertyType || "Not specified",
        "Received At": new Date(contact.createdAt).toLocaleString(),
      }
    })
  }),
  // Subscription Purchase
  subscriptionPurchased: (broker: any, subscription: any) => ({
    subject: `✨ Subscription Activated: ${subscription.plan} Plan`,
    html: buildHomeLoanTemplate({
      title: "Subscription Activated!",
      subtitle: `Your ${subscription.plan} plan benefits are now active`,
      message: `Thank you for upgrading to ${subscription.plan} plan. Your profile now has enhanced visibility and features.`,
      highlightSection: `
        <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); padding: 25px; border-radius: 8px; margin: 20px 0;">
          <div style="display: flex; align-items: center; gap: 15px;">
            <div style="background: rgba(255,255,255,0.2); color: white; width: 50px; height: 50px; 
                        border-radius: 8px; display: flex; align-items: center; justify-content: center; 
                        font-size: 24px;">
              ⭐
            </div>
            <div>
              <h3 style="margin: 0 0 5px 0; color: white;">Premium Features Activated</h3>
              <p style="margin: 0; color: rgba(255,255,255,0.9); font-size: 14px;">
                Enjoy your new subscription benefits
              </p>
            </div>
          </div>
        </div>
      `,
      infoItems: {
        "Plan": subscription.plan,
        "Amount": subscription.plan === "FREE" ? "Free" : `₹${subscription.plan === "FEATURED" ? "1999" : "4999"}/month`,
        "Start Date": new Date(subscription.startDate).toLocaleDateString(),
        "End Date": subscription.endDate ? new Date(subscription.endDate).toLocaleDateString() : "Auto-renew",
        "Features": getPlanFeatures(subscription.plan),
        "Profile URL": `${process.env.NEXT_PUBLIC_APP_URL}/brokers/${broker.profileSlug}`
      }
    })
  }),

  // New Review Notification
  newReview: (broker: any, review: any, user: any) => ({
    subject: `⭐ New Review Received: ${review.rating}/5 stars`,
    html: buildHomeLoanTemplate({
      title: "New Review Received!",
      subtitle: `${user.name} rated you ${review.rating}/5 stars`,
      message: `A client has left a review on your profile. Reviews help build trust and attract more clients.`,
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
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/brokers/${broker.profileSlug}" 
             style="background-color: #2563eb; color: white; padding: 14px 28px; 
                    text-decoration: none; border-radius: 8px; display: inline-block;
                    font-weight: bold; font-size: 16px;">
            View Your Profile
          </a>
        </div>
      `,
      infoItems: {
        "Client": user.name || "Anonymous",
        "Rating": `${review.rating}/5 stars`,
        "Review Date": new Date(review.createdAt).toLocaleDateString(),
        "Your Average Rating": broker.avgRating.toFixed(1),
        "Total Reviews": broker.totalReviews,
        "Profile Views": broker.profileViews || 0
      }
    })
  }),

  // Password Reset
  emailChangeVerification: (name: string, verificationLink: string, expiryHours: number = 1) => ({
    subject: '🔐 Verify Your New Email Address',
    html: buildHomeLoanTemplate({
      title: "Confirm Your Email Change",
      subtitle: "Secure your account",
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
            <strong>⚠️ Security Notice:</strong> This link expires in ${expiryHours} hour${expiryHours > 1 ? 's' : ''}. If you didn't request this, please ignore this email.
          </p>
        </div>
      `,
      infoItems: {
        "Verification Link": verificationLink,
        "Expires In": `${expiryHours} hour${expiryHours > 1 ? 's' : ''}`,
        "Support": "support@homeloanmarket.com"
      }
    })
  }),

  passwordReset: (name: string, resetLink: string, expiryHours: number = 1) => ({
    subject: '🔐 Reset Your HomeLoanMarket Password',
    html: buildHomeLoanTemplate({
      title: "Password Reset Request",
      subtitle: "Secure your account",
      message: `Hello ${name}, you requested to reset your password. Click the button below to create a new password.`,
      highlightSection: `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" 
             style="background-color: #2563eb; color: white; padding: 14px 28px; 
                    text-decoration: none; border-radius: 8px; display: inline-block;
                    font-weight: bold; font-size: 16px;">
            Reset Password
          </a>
        </div>
        <div style="background: #fef2f2; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #fca5a5;">
          <p style="color: #dc2626; font-size: 14px; margin: 0;">
            <strong>⚠️ Security Notice:</strong> This link expires in ${expiryHours} hour${expiryHours > 1 ? 's' : ''}. If you didn't request this, please ignore this email.
          </p>
        </div>
      `,
      infoItems: {
        "Reset Link": resetLink,
        "Expires In": `${expiryHours} hour${expiryHours > 1 ? 's' : ''}`,
        "Requested At": new Date().toLocaleString(),
        "Support": "support@homeloanmarket.com"
      }
    })
  }),

  // Generic Notification
  notification: (title: string, message: string, infoItems: Record<string, string>) => ({
    subject: `📢 ${title}`,
    html: buildHomeLoanTemplate({
      title,
      subtitle: "Notification from HomeLoanMarket",
      message,
      infoItems
    })
  }),

  // Admin Notification - New Broker Registration
  adminNewBroker: (user: any, broker: any) => ({
    subject: `🏠 New Broker Registration: ${broker.displayName}`,
    html: buildHomeLoanTemplate({
      title: "New Broker Registration",
      subtitle: "A new broker has joined the platform",
      message: `A new broker has registered and requires verification.`,
      highlightSection: `
        <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin-top: 20px; border: 1px solid #f59e0b;">
          <p style="color: #92400e; margin: 0; font-size: 14px; font-weight: bold;">
            ⚡ Action Required: Broker Verification
          </p>
          <ul style="color: #92400e; margin: 10px 0 0 20px; padding-left: 0; font-size: 13px;">
            <li>Review broker documents in admin dashboard</li>
            <li>Check registration details</li>
            <li>Approve or request additional documents</li>
          </ul>
        </div>
      `,
      infoItems: {
        "Broker Name": broker.displayName,
        "Company": broker.companyName || "Individual",
        "User": `${user.name} (${user.email})`,
        "City": broker.city,
        "Experience": `${broker.experienceYears} years`,
        "Registration Date": new Date().toLocaleDateString(),
        "Profile URL": `${process.env.NEXT_PUBLIC_APP_URL}/admin/brokers/${broker.id}`,
        "Verification Status": "UNVERIFIED"
      }
    })
  }),

  // Contact Form - New message notification to broker
  newContactMessage: (broker: any, contact: any) => ({
    subject: `🎯 New Contact Message from ${contact.name}`,
    html: buildHomeLoanTemplate({
      title: "New Contact Message Received!",
      subtitle: "A potential client has reached out to you",
      message: `You have received a new contact message. Please respond promptly to increase conversion chances.`,
      highlightSection: `
        <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #f59e0b;">
          <div style="display: flex; align-items: center; gap: 15px;">
            <div style="background: #f59e0b; color: white; width: 50px; height: 50px; 
                        border-radius: 8px; display: flex; align-items: center; justify-content: center; 
                        font-size: 24px;">
              📞
            </div>
            <div>
              <h3 style="margin: 0 0 5px 0; color: #92400e;">Contact Lead Now</h3>
              <p style="margin: 0; color: #92400e; font-size: 14px;">
                Early contact increases conversion by 300%
              </p>
            </div>
          </div>
        </div>
      `,
      infoItems: {
        "From": contact.name,
        "Email": contact.email,
        "Phone": contact.phone,
        "Subject": contact.subject,
        "Message": contact.message,
        "Loan Type": contact.loanType || "Not specified",
        "Property Type": contact.propertyType || "Not specified",
        "Loan Amount": contact.loanAmount || "Not specified",
        "Timeline": contact.timeline || "Exploring options",
        "Received At": new Date(contact.createdAt).toLocaleString(),
      }
    })
  }),

  // Contact Form - Confirmation to customer
  contactMessageConfirmation: (user: any, broker: any, message: any) => ({
    subject: `✅ Your message has been sent to ${broker.displayName || 'the broker'}`,
    html: buildHomeLoanTemplate({
      title: "Message Sent Successfully!",
      subtitle: "Your inquiry has been received",
      message: `Thank you for reaching out. Your message has been sent to ${broker.displayName || 'the broker'}. They will get back to you soon.`,
      highlightSection: `
        <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #86efac;">
          <div style="display: flex; align-items: center; gap: 15px;">
            <div style="background: #22c55e; color: white; width: 50px; height: 50px; 
                        border-radius: 8px; display: flex; align-items: center; justify-content: center; 
                        font-size: 24px;">
              ✅
            </div>
            <div>
              <h3 style="margin: 0 0 5px 0; color: #15803d;">Message Delivered</h3>
              <p style="margin: 0; color: #15803d; font-size: 14px;">
                The broker will respond within 24 hours
              </p>
            </div>
          </div>
        </div>
      `,
      infoItems: {
        "Broker": broker.displayName || broker.companyName || "Broker",
        "Company": broker.companyName || "Independent",
        "Email": broker.email,
        "Phone": broker.phone || "Not provided",
        "Your Message": message.subject || "No subject",
        "Sent At": new Date(message.createdAt).toLocaleString(),
        "Estimated Response": "24 hours",
        "Support": "support@homeloanmarket.com"
      }
    })
  }),
};

// Helper function to build HomeLoanMarket email template
function buildHomeLoanTemplate(options: {
  title: string;
  subtitle: string;
  message: string;
  highlightSection?: string;
  infoItems: Record<string, string>;
}) {
  const infoItemsHtml = Object.entries(options.infoItems)
    .map(([key, value]) => `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; color: #475569; width: 150px; font-weight: 500;">${key}:</td>
        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-weight: 500;">${value}</td>
      </tr>
    `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
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
        <!-- Header -->
        <div class="header">
          <div class="logo">HomeLoanMarket</div>
          <div class="tagline">India's Trusted Mortgage Broker Platform</div>
        </div>
        
        <!-- Content -->
        <div class="content">
          <h1 style="color: #1e293b; margin-top: 0; font-size: 28px; font-weight: 700;">${options.title}</h1>
          <h2 style="color: #475569; font-size: 18px; margin: 10px 0 25px 0; font-weight: 500;">${options.subtitle}</h2>
          
          <p style="margin-bottom: 25px; color: #475569; font-size: 15px;">${options.message}</p>
          
          ${options.highlightSection || ''}
          
          <!-- Information Table -->
          <table class="info-table" cellpadding="10">
            ${infoItemsHtml}
          </table>
          
          <p style="color: #64748b; font-size: 14px; margin-top: 35px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
            Need help? Contact us at <a href="mailto:support@homeloanmarket.com" style="color: #2563eb; text-decoration: none;">support@homeloanmarket.com</a>
          </p>
        </div>
        
        <!-- Footer -->
        <div class="footer">
          <p>© ${new Date().getFullYear()} HomeLoanMarket. All rights reserved.</p>
          <p>This email was sent to you as a registered user of HomeLoanMarket.</p>
          
          <div class="social-links">
            <a href="https://twitter.com/homeloanmarket">Twitter</a> | 
            <a href="https://facebook.com/homeloanmarket">Facebook</a> | 
            <a href="https://linkedin.com/company/homeloanmarket">LinkedIn</a>
          </div>
          
          <p style="margin-top: 20px; font-size: 11px; color: #94a3b8;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/privacy" style="color: #64748b; margin: 0 8px;">Privacy Policy</a> | 
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/terms" style="color: #64748b; margin: 0 8px;">Terms of Service</a> | 
            <a href="mailto:unsubscribe@homeloanmarket.com?subject=Unsubscribe" style="color: #64748b; margin: 0 8px;">Unsubscribe</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function getPlanFeatures(plan: string): string {
  const features = {
    "FREE": "Basic listing, 5 leads/month",
    "FEATURED": "Featured placement, enhanced visibility, priority support"
  };
  return features[plan as keyof typeof features] || "Basic features";
}
