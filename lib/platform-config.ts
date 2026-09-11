export type PlatformConfig = {
  resendApiKey: string | null
  emailFrom: string | null
  emailFromName: string
  supportEmail: string | null
  adminEmails: string[]
  emailReplyTo: string | null
  emailUnsubscribe: string | null
  appUrl: string
}

export function parseAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS
  if (raw && raw.trim().length > 0) {
    const parts = raw.split(',').map((v) => v.trim().toLowerCase())
    const valid = parts.filter((v) => v.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
    const unique = Array.from(new Set(valid))
    if (unique.length > 0) return unique
  }

  const legacy = process.env.ADMIN_EMAIL
  if (legacy && legacy.trim().length > 0) {
    const normalized = legacy.trim().toLowerCase()
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      return [normalized]
    }
  }

  return []
}

export const platformConfig: PlatformConfig = {
  resendApiKey: process.env.RESEND_API_KEY || null,
  emailFrom: process.env.EMAIL_FROM || null,
  emailFromName: process.env.EMAIL_FROM_NAME || 'HomeLoanMarket',
  supportEmail: process.env.SUPPORT_EMAIL || null,
  adminEmails: parseAdminEmails(),
  emailReplyTo: process.env.EMAIL_REPLY_TO || null,
  emailUnsubscribe: process.env.EMAIL_UNSUBSCRIBE || null,
  appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://homeloanmarket.com',
}
