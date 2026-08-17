// src/types/environment.d.ts
namespace NodeJS {
  interface ProcessEnv {
    // Authentication (Auth.js) — AUTH_SECRET is the single authoritative secret.
    AUTH_SECRET: string;          // Sole secret for signing/decoding JWTs across Auth.js, proxy.ts, and claim-context.ts
    AUTH_URL: string;             // Canonical base URL for authentication redirects (https://homeloanmarket.net)
    AUTH_GOOGLE_CLIENT_ID?: string; // Google OAuth Client ID
    AUTH_GOOGLE_CLIENT_SECRET?: string; // Google OAuth Client Secret

    // Database
    DATABASE_URL: string;         // MongoDB connection URL

    // Encryption
    AES_SECRET: string;           // Secret for AES encryption of passwords

    // Public URLs
    NEXT_PUBLIC_API: string;      // Public API URL (optional, if used)
    NEXT_PUBLIC_URL: string;      // Public app URL (https://homeloanmarket.net)
    NEXT_PUBLIC_APP_URL: string;      // Public app URL (https://homeloanmarket.net)

    UPSTASH_REDIS_REST_TOKEN: string;

    // Optional/Redundant (included for flexibility)
    GOOGLE_AUTH_EMAIL?: string;   // Alias for EMAIL_USER (optional)
    GOOGLE_AUTH_PASS?: string;    // Alias for EMAIL_PASS (optional)

    CLOUDINARY_CLOUD_NAME: string
    CLOUDINARY_API_KEY: string
    CLOUDINARY_API_SECRET: string
    CLOUDINARY_API_ENVIRONMANT: string

    NEXT_PUBLIC_STRIPE_PK: string
    STRIPE_SECRET_KEY: string
    STRIPE_WEBHOOK_SECRET: string
    TESTCARD: string

    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: string



    EMAIL_SERVER_USER: string
    EMAIL_SERVER_PASS: string
    EMAIL_SERVER_HOST: string
    EMAIL_SERVER_PORT: string
    EMAIL_FROM: string
    ADMIN_EMAIL: string
    SECONDARY_EMAIL: string
    EMAIL_FROM_NAME: string
    RESEND_API_KEY: string

    TWILIO_ACCOUNT_SID: string
    TWILIO_AUTH_TOKEN: string
    TWILIO_VERIFY_SERVICE_SID: string
    TWILIO_PHONE_NUMBER: string
  }
}