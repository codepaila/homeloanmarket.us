import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { clientIp } from "@/lib/origin";

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

// Password-reset completion is an unauthenticated, credential-changing POST.
// The 256-bit token makes brute force infeasible, but the endpoint previously
// had no distributed limit at all, so repeated attempts/abuse were unbounded.
// A modest per-IP sliding window preserves legitimate retries after a typo.
export const resetPasswordRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "15 m"), // 10 reset attempts per 15 minutes per IP
  analytics: true,
  prefix: "ratelimit:reset-password",
});

export const contactBrokerRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(15, "60 m"), // 15 contact attempts per hour per IP
  analytics: true,
  prefix: "ratelimit:contact-broker",
});

// Secondary guard for the public broker contact endpoint, keyed by the target
// broker. This bounds how many contact messages a single broker can receive in
// a window (protecting the broker's inbox and the persisted lead stream) even
// when the sender rotates spoofed X-Forwarded-For values. Deliberately more
// permissive than the per-IP/per-email limit so a legitimately popular broker
// is not throttled below normal lead volume.
export const contactBrokerTargetRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(120, "60 m"), // 120 contact attempts per hour per broker
  analytics: true,
  prefix: "ratelimit:contact-broker-target",
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

// Company advertising coupon validation. Company-scoped, distributed limiter
// executed BEFORE any Stripe call so a valid Company account cannot be used to
// amplify provider lookups or enumerate promotion codes.
export const companyCouponValidateRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(20, "60 m"), // 20 coupon checks per hour per company/IP
  analytics: true,
  prefix: "ratelimit:company-coupon-validate",
});

// Broker registration, keyed by the normalized email identity in addition to
// the existing per-IP limiter. Bounds repeated account/verification-email
// creation for the same email even across rotating IPs.
export const brokerRegisterEmailRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.fixedWindow(3, "30 m"), // 3 registrations per email per 30 minutes
  analytics: true,
  prefix: "ratelimit:broker-register-email",
});

// Metered Google location lookups (autocomplete / geocode / resolve). These
// are public endpoints backed by paid Google APIs; a distributed per-IP,
// per-endpoint limiter bounds provider cost before any Google call.
export const locationApiRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(90, "10 m"), // 90 lookups per 10 minutes per IP/endpoint
  analytics: true,
  prefix: "ratelimit:location-api",
});

// Returns true when the location lookup should be rejected. Mirrors the
// existing auth limiter fail-open policy: a Redis outage must not take down
// legitimate public location search (broker/company onboarding, directory
// search). The residual fail-open risk is documented for a later phase.
export async function locationLookupExceeded(endpoint: string, request: Request): Promise<boolean> {
  try {
    const { success } = await locationApiRateLimit.limit(`location:${endpoint}:${clientIp(request)}`);
    return !success;
  } catch (error) {
    console.warn("Location rate limiter unavailable; allowing request", {
      endpoint,
      error: error instanceof Error ? error.message : "unknown",
    });
    return false;
  }
}

// Distributed profile-view dedup gate: at most one counted view per
// (broker, client) per hour. This is a gate, not a rate limit, and analytics is
// disabled so the hot public read path stays cheap.
export const profileViewDedup = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.fixedWindow(1, "1 h"),
  analytics: false,
  prefix: "ratelimit:profile-view-dedup",
});

// ---------------------------------------------------------------------------
// Public advertisement tracking (anonymous). Impressions and clicks are
// unauthenticated writes to the AdEvent collection, so a distributed per-IP
// limit bounds event inflation. These mirror the existing fail-open location
// limiter: a Redis outage must not break ad rendering, so an unavailable
// limiter allows the request rather than failing the page.
// ---------------------------------------------------------------------------
export const adImpressionRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, "10 m"), // 100 impressions per 10 minutes per IP
  analytics: true,
  prefix: "ratelimit:ad-impression",
});

export const adClickRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(30, "10 m"), // 30 clicks per 10 minutes per IP
  analytics: true,
  prefix: "ratelimit:ad-click",
});

// Distributed impression dedup gate: at most one counted impression per
// (advertisement, client) per short window, replacing reliance on a spoofable
// IP and a database round-trip. Analytics is disabled so the hot public read
// path stays cheap; this is a gate, not a metric.
export const adImpressionDedup = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.fixedWindow(1, "10 s"),
  analytics: false,
  prefix: "ratelimit:ad-impression-dedup",
});

// Returns true when the ad event should be rejected for exceeding the public
// limit. Fails open (returns false) when the limiter is unavailable, matching
// the existing public-location limiter policy.
export async function adImpressionRateLimitExceeded(ip: string): Promise<boolean> {
  try {
    const { success } = await adImpressionRateLimit.limit(`ad-impression:${ip}`);
    return !success;
  } catch (error) {
    console.warn("Ad impression rate limiter unavailable; allowing request", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return false;
  }
}

export async function adClickRateLimitExceeded(ip: string): Promise<boolean> {
  try {
    const { success } = await adClickRateLimit.limit(`ad-click:${ip}`);
    return !success;
  } catch (error) {
    console.warn("Ad click rate limiter unavailable; allowing request", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return false;
  }
}

// Returns true when an identical impression for this (advertisement, client)
// was already counted inside the dedup window. Fails open (returns false) when
// the limiter is unavailable so tracking never breaks ad rendering.
export async function adImpressionIsDuplicate(advertisementId: string, ip: string): Promise<boolean> {
  try {
    const { success } = await adImpressionDedup.limit(`ad-impression:${advertisementId}:${ip}`);
    return !success;
  } catch (error) {
    console.warn("Ad impression dedup limiter unavailable; skipping gate", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return false;
  }
}

// Authenticated image upload is CPU-intensive (Sharp decode/encode) and can
// incur Cloudinary cost. Bound it per user. Ordinary profile editing needs a
// handful of uploads, so 20 per 10 minutes is generous for legitimate use
// while preventing a scripted re-encode flood.
export const uploadImageRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(20, "10 m"), // 20 uploads per 10 minutes per user
  analytics: true,
  prefix: "ratelimit:upload-image",
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