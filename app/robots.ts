import type { MetadataRoute } from 'next'
import { canonicalUrl } from '@/lib/seo'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin/',
        '/broker/',
        '/dashboard/',
        '/api/',
        '/auth/',
        '/claim-broker/',
      ],
    },
    sitemap: canonicalUrl('/sitemap.xml'),
  }
}
