import type { NextConfig } from "next";

// ---------------------------------------------------------------------------
// Browser security headers
// ---------------------------------------------------------------------------
//
// These are set globally from the authoritative Next.js `headers()` layer
// (no new middleware; proxy.ts is untouched). The CSP is derived from the
// repository's actual external origins:
//   - Google Tag Manager / GA4  -> https://www.googletagmanager.com,
//                                  https://www.google-analytics.com,
//                                  https://*.google-analytics.com
//   - Cloudinary / Unsplash / YouTube thumbnails + admin-managed blog/broker
//     images are loaded through <img>/next/image, so `img-src ... https:` is
//     required (image URLs are stored content, not a fixed allowlist).
//   - Google Places/Geocoding and Cloudinary uploads are SERVER-side only
//     (see lib/location/google-place.ts, lib/cloudinary.ts), so they do not
//     need browser connect-src/script-src entries.
//   - Stripe Checkout and Google OAuth are top-level redirects (not iframes,
//     not client Stripe.js), so no Stripe origins are required.
//
// `'unsafe-inline'` is required and audited:
//   1. app/layout.tsx:57 ships an inline theme-bootstrap script (no nonce).
//   2. Next.js App Router injects inline bootstrap/RSC-flight scripts; nonces
//      require a middleware and proxy.ts must not be replaced in this phase.
//   3. @next/third-parties injects inline GTM/GA consent configuration.
//   4. React components use inline `style={{...}}` attributes.
// No `'unsafe-eval'` is present (verified: no eval/new Function in app code).
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://analytics.google.com",
  "frame-src 'none'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "media-src 'self'",
].join("; ");

// Features actually required by the application: only `clipboard-write` is
// used (admin copy-link/copy-URL actions via navigator.clipboard.writeText).
// Everything else is disabled. No browser geolocation/camera/microphone/
// payment/fullscreen API is used anywhere in the codebase.
const PERMISSIONS_POLICY = [
  "accelerometer=()",
  "autoplay=()",
  "browsing-topics=()",
  "camera=()",
  "clipboard-read=()",
  "clipboard-write=(self)",
  "display-capture=()",
  "encrypted-media=()",
  "fullscreen=()",
  "geolocation=()",
  "gyroscope=()",
  "hid=()",
  "interest-cohort=()",
  "magnetometer=()",
  "microphone=()",
  "midi=()",
  "payment=()",
  "picture-in-picture=()",
  "publickey-credentials-get=()",
  "screen-wake-lock=()",
  "serial=()",
  "usb=()",
  "web-share=()",
  "xr-spatial-tracking=()",
].join(", ");

const nextConfig: NextConfig = {
  // Enable Turbopack (default in Next 16)
  turbopack: {},
  compress: true,
  // Never advertise the framework via the X-Powered-By response header.
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "lodash-es"
    ],
    // Allow request bodies larger than the 10MB default to reach the media
    // upload route so server-side file-size validation can reject oversized
    // uploads cleanly instead of the middleware truncating the multipart body.
    proxyClientMaxBodySize: "12mb",
    // middlewareClientMaxBodySize: "12mb",
  },

  compiler: {
    // Keep console.error / console.warn in production so server-side provider
    // errors (e.g. Stripe checkout failures) remain visible in logs for
    // diagnostics, while stripping verbose log/info/debug output.
    removeConsole: process.env.NODE_ENV === "production"
      ? { exclude: ["error", "warn"] }
      : false,
  },

  productionBrowserSourceMaps: false, // no source maps in production

  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400, // cache for 1 day
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com", pathname: "**" },
      { protocol: "https", hostname: "res.cloudinary.com", pathname: "**" },
      { protocol: "https", hostname: "img.youtube.com", pathname: "**" },
    ],
  },

async headers() {
  const PUBLIC_CACHE = {
    key: "Cache-Control",
    value: "public, max-age=0, must-revalidate",
  };
  const PRIVATE_CACHE = {
    key: "Cache-Control",
    value: "private, no-store, no-cache, must-revalidate",
  };

  const securityHeaders = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
    { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    // HSTS is only emitted for production builds, where the deployment is
    // expected to terminate TLS and serve HTTPS-only. It is intentionally
    // omitted in development so localhost is never pinned. `preload` and
    // `includeSubDomains` are NOT enabled (they require verified domain /
    // subdomain HTTPS coverage).
    ...(process.env.NODE_ENV === "production"
      ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]
      : []),
  ];

  // Next.js applies every matching rule in array order and the LAST value for a
  // given header key wins. The global rule must therefore come FIRST, with the
  // more specific private rules AFTER it — otherwise the catch-all `public`
  // policy silently overrides the private/no-store policy on session-bearing
  // responses (verified regression).
  return [
    // (1) Global: browser security headers on every route, plus the public
    //     cache policy for public HTML/content and public API responses.
    {
      source: "/(.*)",
      headers: [PUBLIC_CACHE, ...securityHeaders],
    },
    // (2) Secure default for the ENTIRE API surface: never publicly cacheable.
    //     This covers /api/auth (Auth.js sessions), /api/admin, /api/account,
    //     /api/user, /api/notifications, /api/support, /api/subscription,
    //     /api/company/onboarding, /api/company/requests,
    //     /api/company/subscription/*, /api/broker-registration, /api/brokers/me,
    //     /api/brokers/[id]/contacts, /api/contacts/my, /api/claims, /api/upload,
    //     /api/stripe/webhook, and any session-varying public read.
    {
      source: "/api/:path*",
      headers: [PRIVATE_CACHE],
    },
    // (3) Explicitly public, non-session-varying API responses (safe to share).
    //     These override (2) because they appear later.
    ...[
      "/api/brokers/featured",
      "/api/subscription/plans",
      "/api/company/subscription/plans",
      "/api/company/:slug/reviews",
      "/api/ads/public",
      "/api/cities",
      "/api/states",
      "/api/property-types",
    ].map((source) => ({ source, headers: [PUBLIC_CACHE] })),
    // (4) Authenticated page areas: private/no-store.
    ...[
      "/admin/:path*",
      "/broker/:path*",
      "/dashboard/:path*",
    ].map((source) => ({ source, headers: [PRIVATE_CACHE] })),
  ];
}

};

export default nextConfig;


