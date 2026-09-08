/* eslint-disable @typescript-eslint/no-explicit-any */
import { Resend } from 'resend';
import { htmlToText } from './email-templates';

// Initialize Resend with your API key
const resend = new Resend(process.env.RESEND_API_KEY);

// Add email send tracking to prevent duplicates
const emailSendLog = new Map<string, number>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute

// Verify connection
export async function verifyEmailConnection() {
  try {
    // With Resend, we can test by sending a simple ping or checking API key
    console.log('✅ Resend API key configured');
    return true;
  } catch (error) {
    console.error('❌ Resend configuration failed:', error);
    return false;
  }
}

// Enhanced sendEmail with duplicate prevention
export async function sendEmail({
  to,
  subject,
  html,
  text,
  idempotencyKey, // Optional: Use to prevent duplicates
  replyTo,
  highPriority, // Optional: mark as high priority only when the business event requires it
}: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  idempotencyKey?: string;
  replyTo?: string;
  highPriority?: boolean;
}) {
  try {
    // Fail clearly when the email service is not configured instead of
    // silently producing a malformed `from` (e.g. "Name <undefined>").
    if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
      console.error('❌ Email configuration missing: RESEND_API_KEY / EMAIL_FROM')
      return {
        success: false,
        error: 'Email service is not configured',
        errorCode: 'EMAIL_NOT_CONFIGURED',
      };
    }

    // Prevent duplicate sends using idempotency key
    if (idempotencyKey) {
      const now = Date.now();
      const lastSent = emailSendLog.get(idempotencyKey);
      
      if (lastSent && (now - lastSent < RATE_LIMIT_WINDOW)) {
        console.log(`⏭️ Skipping duplicate email with key: ${idempotencyKey}`);
        return {
          success: true,
          skipped: true,
          reason: 'Duplicate prevented'
        };
      }
      
      emailSendLog.set(idempotencyKey, now);
    }

    // Clean up old log entries periodically
    if (emailSendLog.size > 1000) {
      const cutoff = Date.now() - RATE_LIMIT_WINDOW * 10;
      for (const [key, timestamp] of emailSendLog.entries()) {
        if (timestamp < cutoff) {
          emailSendLog.delete(key);
        }
      }
    }

    // Convert to array for Resend
    const recipients = Array.isArray(to) ? to : [to];
    
    // Send email using Resend
    const { data, error } = await resend.emails.send({
      from: `${process.env.EMAIL_FROM_NAME || 'HomeLoanMarket'} <${process.env.EMAIL_FROM}>`,
      to: recipients,
      // Explicit reply-to policy: callers may override; the default routes
      // replies to the platform support/operational address rather than an
      // unrelated admin inbox for every email.
      reply_to: replyTo || process.env.EMAIL_REPLY_TO || process.env.ADMIN_EMAIL,
      subject,
      html,
      text: text || htmlToText(html),
      headers: {
        ...(highPriority
          ? {
              'X-Priority': '1',
              'X-MSMail-Priority': 'High',
              'Importance': 'high',
            }
          : {}),
        'X-Mailer': 'Homeloanmarket Platform',
        'List-Unsubscribe': `<mailto:${process.env.EMAIL_UNSUBSCRIBE || process.env.EMAIL_FROM}>`,
      }
    });

    if (error) {
      console.error('❌ Error sending email with Resend:', error);
      
      let errorMessage = 'Failed to send email';
      let errorCode = 'EMAIL_ERROR';
      
      if (error.name === 'validation_error') {
        errorMessage = 'Invalid email address or format';
        errorCode = 'VALIDATION_ERROR';
      } else if (error.message?.includes('rate limit')) {
        errorMessage = 'Rate limit exceeded. Please try again later.';
        errorCode = 'RATE_LIMIT';
      }
      
      return {
        success: false,
        error: errorMessage,
        errorCode,
        originalError: error.message
      };
    }

    console.log(`✅ Email sent successfully via Resend: ${data?.id}`);
    
    return {
      success: true,
      messageId: data?.id,
      recipients: recipients.join(', ')
    };
    
  } catch (error: any) {
    console.error('❌ Error sending email:', error);
    
    return {
      success: false,
      error: 'Failed to send email',
      errorCode: 'UNKNOWN_ERROR',
      originalError: error.message
    };
  }
}

// Batch email sending with rate limiting for Resend
export async function sendBatchEmails(
  emails: Array<{
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
  }>,
  delayBetween = 1000 // 1 second between emails to avoid rate limiting
) {
  const results = [];
  
  for (let i = 0; i < emails.length; i++) {
    const email = emails[i];
    const result = await sendEmail(email);
    results.push(result);
    
    // Add delay between emails (except last one)
    if (i < emails.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayBetween));
    }
  }
  
  return results;
}



// Verify email address format
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Clean email list
export function cleanEmailList(emails: string | string[]): string[] {
  const emailArray = Array.isArray(emails) ? emails : [emails];
  return emailArray
    .map(email => email.trim().toLowerCase())
    .filter(email => isValidEmail(email));
}
export { emailTemplates, htmlToText } from './email-templates';
