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
    removeConsole: process.env.NODE_ENV === "production",
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


