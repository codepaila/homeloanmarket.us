import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Broker-specific rate limits
export const brokerRegisterRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.fixedWindow(3, "30 m"), // 3 registrations per 30 minutes per IP
  analytics: true,
  prefix: "ratelimit:broker-register",
});

export const customerRegisterRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.fixedWindow(3, "30 m"), // 3 customer registrations per 30 minutes per IP
  analytics: true,
  prefix: "ratelimit:customer-register",
});

export const leadSubmissionRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "60 m"), // 10 lead submissions per hour per user
  analytics: true,
  prefix: "ratelimit:lead-submission",
});

export const brokerLoginRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, "10 m"), // 5 login attempts per 10 minutes
  analytics: true,
  prefix: "ratelimit:broker-login",
});

export const forgotPasswordRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.fixedWindow(5, "60 m"), // 5 requests per hour per IP
  analytics: true,
  prefix: "ratelimit:forgot-password",
});

export const resendVerificationRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.fixedWindow(3, "60 m"), // 3 resend requests per hour per IP
  analytics: true,
  prefix: "ratelimit:resend-verification",
});

export const contactBrokerRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(15, "60 m"), // 15 contact attempts per hour per IP
  analytics: true,
  prefix: "ratelimit:contact-broker",
});

export const claimPreviewRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(30, "10 m"), // 30 previews per 10 minutes per IP/token
  analytics: true,
  prefix: "ratelimit:claim-preview",
});

export const claimStartRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.fixedWindow(10, "30 m"), // 10 claim starts per 30 minutes per IP/token
  analytics: true,
  prefix: "ratelimit:claim-start",
});

export const claimEmailSubmissionRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "30 m"), // 10 email submissions per 30 minutes per IP/token
  analytics: true,
  prefix: "ratelimit:claim-email",
});

export const claimReauthRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.fixedWindow(10, "10 m"), // 10 reauthentication attempts per 10 minutes per IP/token
  analytics: true,
  prefix: "ratelimit:claim-reauth",
});

export const claimCompleteRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.fixedWindow(10, "10 m"), // 10 completion attempts per 10 minutes per IP/token
  analytics: true,
  prefix: "ratelimit:claim-complete",
});

export const claimSetupRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.fixedWindow(5, "30 m"), // 5 claim account setups per 30 minutes per IP/token
  analytics: true,
  prefix: "ratelimit:claim-setup",
});

export const adminClaimInvitationRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.fixedWindow(20, "60 m"), // 20 invitations per hour per admin
  analytics: true,
  prefix: "ratelimit:admin-claim-invitation",
});

export const adminClaimResendRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.fixedWindow(20, "60 m"), // 20 resends per hour per admin
  analytics: true,
  prefix: "ratelimit:admin-claim-resend",
});

export const adminClaimRevokeRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.fixedWindow(20, "60 m"), // 20 revokes per hour per admin
  analytics: true,
  prefix: "ratelimit:admin-claim-revoke",
});

// Account deletion is destructive; bound per-user (self-service) and per-admin
// (admin deletion) retries tightly so a client cannot hammer the endpoint.
export const accountDeletionRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.fixedWindow(3, "10 m"), // 3 deletion attempts per 10 minutes
  analytics: true,
  prefix: "ratelimit:account-deletion",
});

// In-memory rate limiting for email sending
const emailAttempts = new Map<string, { count: number, firstAttempt: number }>()
const EMAIL_RATE_LIMIT_WINDOW = 10 * 60 * 1000 // 10 minutes
const MAX_EMAIL_ATTEMPTS = 5

export function checkEmailRateLimit(email: string, type: string): { allowed: boolean; message?: string } {
  const now = Date.now()
  const key = `${type}:${email.toLowerCase()}`
  
  const attempts = emailAttempts.get(key)
  
  if (!attempts) {
    emailAttempts.set(key, { count: 1, firstAttempt: now })
    return { allowed: true }
  }
  
  // Check if window has expired
  if (now - attempts.firstAttempt > EMAIL_RATE_LIMIT_WINDOW) {
    // Reset window
    emailAttempts.set(key, { count: 1, firstAttempt: now })
    return { allowed: true }
  }
  
  // Check max attempts
  if (attempts.count >= MAX_EMAIL_ATTEMPTS) {
    const timeLeft = EMAIL_RATE_LIMIT_WINDOW - (now - attempts.firstAttempt)
    const minutesLeft = Math.ceil(timeLeft / (60 * 1000))
    
    return {
      allowed: false,
      message: `Too many email attempts. Please try again in ${minutesLeft} minutes.`
    }
  }
  
  // Increment attempt count
  attempts.count += 1
  emailAttempts.set(key, attempts)
  
  return { allowed: true }
}

// Clean up old entries periodically
export function cleanupRateLimitCache() {
  const now = Date.now()
  const cutoff = now - EMAIL_RATE_LIMIT_WINDOW * 2
  
  for (const [key, data] of emailAttempts.entries()) {
    if (data.firstAttempt < cutoff) {
      emailAttempts.delete(key)
    }
  }
}

// Call cleanup every hour
setInterval(cleanupRateLimitCache, 60 * 60 * 1000)