import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable Turbopack (default in Next 16)
  turbopack: {},
  compress: true,
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
  return [
    // Session-sensitive routes must never be treated as publicly cacheable.
    // Auth.js session/auth endpoints, admin and broker pages, and dashboard
    // responses are explicitly private/no-store. These rules are listed
    // before the catch-all so they take precedence.
    {
      source: "/api/auth/:path*",
      headers: [
        { key: "Cache-Control", value: "private, no-store, no-cache, must-revalidate" },
      ],
    },
    {
      source: "/admin/:path*",
      headers: [
        { key: "Cache-Control", value: "private, no-store, no-cache, must-revalidate" },
      ],
    },
    {
      source: "/broker/:path*",
      headers: [
        { key: "Cache-Control", value: "private, no-store, no-cache, must-revalidate" },
      ],
    },
    {
      source: "/dashboard/:path*",
      headers: [
        { key: "Cache-Control", value: "private, no-store, no-cache, must-revalidate" },
      ],
    },
    // Public marketing/content pages remain cacheable per the app's intended
    // architecture (revalidate against origin on every request).
    {
      source: "/(.*)",
      headers: [
        {
          key: "Cache-Control",
          value: "public, max-age=0, must-revalidate",
        },
      ],
    },
  ];
}

};

export default nextConfig;


