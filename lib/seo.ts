import { isPublicBroker, type BrokerPublicState } from '@/lib/broker-policy'

const DEFAULT_SITE_URL = 'https://homeloanmarket.com'

function isUnsafeSeoHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '')
  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.startsWith('fc') ||
    host.startsWith('fd') ||
    host.startsWith('fe80:') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return true
  }

  const octets = host.split('.').map(Number)
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return host.startsWith('127.') || host.startsWith('169.254.')
  }

  return octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168) ||
    octets[0] === 127 ||
    (octets[0] === 169 && octets[1] === 254)
}

function publicOrigin(value: string | undefined) {
  if (!value) return null
  try {
    const url = new URL(value.trim())
    if (!['http:', 'https:'].includes(url.protocol) || isUnsafeSeoHost(url.hostname)) return null
    return url.origin
  } catch {
    return null
  }
}

export function getSiteUrl() {
  const configured = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_URL,
    process.env.AUTH_URL,
  ].map(publicOrigin).find(Boolean)
  return configured || DEFAULT_SITE_URL
}

export function canonicalUrl(path: string) {
  const input = new URL(path, getSiteUrl())
  const url = new URL(input.pathname, getSiteUrl())
  url.search = ''
  url.hash = ''
  url.pathname = url.pathname === '/' ? '/' : url.pathname.replace(/\/+$/, '')
  return url.toString()
}

export function isIndexablePublicBroker(state: BrokerPublicState) {
  return isPublicBroker(state)
}

export function safeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

// ============================================================
// Reusable JSON-LD entity builders (pure, testable, single source).
// Each builder only emits properties backed by real data — never fabricated
// ratings, reviews, credentials, locations, or social profiles.
// ============================================================

// Stable canonical identity for the HomeLoanMarket Organization. Reused across
// every page that emits Organization/WebSite/publisher JSON-LD so machines can
// resolve a single entity identity.
export function organizationId() {
  return `${canonicalUrl('/')}#organization`
}

export type OrganizationLdInput = {
  name: string
  description?: string
  url: string
  logo?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  sameAs?: Array<string | null | undefined>
}

export type OrganizationLd = {
  '@context': string
  '@type': 'Organization'
  '@id': string
  name: string
  description?: string
  url: string
  logo?: string
  telephone?: string
  email?: string
  sameAs?: string[]
}

export function organizationJsonLd(input: OrganizationLdInput): OrganizationLd {
  const sameAs = (input.sameAs || []).filter((value): value is string => Boolean(value && /^https?:\/\//i.test(value)))
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': organizationId(),
    name: input.name,
    ...(input.description ? { description: input.description } : {}),
    url: input.url,
    ...(input.logo ? { logo: input.logo } : {}),
    ...(input.contactPhone ? { telephone: input.contactPhone } : {}),
    ...(input.contactEmail ? { email: input.contactEmail } : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
  }
}

export type WebsiteLd = {
  '@context': string
  '@type': 'WebSite'
  '@id': string
  name: string
  url: string
  publisher: { '@id': string }
  potentialAction?: { '@type': 'SearchAction'; target: { '@type': 'EntryPoint'; urlTemplate: string }; 'query-input': string }
}

export function websiteJsonLd(input: { name: string; url: string; searchTarget?: string }): WebsiteLd {
  const website: WebsiteLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${canonicalUrl('/')}#website`,
    name: input.name,
    url: input.url,
    publisher: { '@id': organizationId() },
  }
  if (input.searchTarget) {
    website.potentialAction = {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: input.searchTarget },
      'query-input': 'required name=search_term',
    }
  }
  return website
}

export type BreadcrumbItem = { name: string; path: string }

export type BreadcrumbLd = {
  '@context': string
  '@type': 'BreadcrumbList'
  itemListElement: Array<{ '@type': 'ListItem'; position: number; name: string; item: string }>
}

export function breadcrumbJsonLd(items: BreadcrumbItem[]): BreadcrumbLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: canonicalUrl(item.path),
    })),
  }
}

export type BrokerEntityInput = {
  name: string
  description?: string | null
  url: string
  image?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
  countryCode?: string
  latitude?: number | null
  longitude?: number | null
  telephone?: string | null
  email?: string | null
  nmls?: string | null
  totalReviews: number
  avgRating: number
}

export type BrokerLocalBusinessLd = {
  '@context': string
  '@type': 'LocalBusiness'
  '@id': string
  name: string
  description?: string
  url: string
  image?: string
  address: {
    '@type': 'PostalAddress'
    addressLocality?: string
    addressRegion?: string
    postalCode?: string
    addressCountry: string
  }
  geo?: { '@type': 'GeoCoordinates'; latitude: number; longitude: number }
  telephone?: string
  email?: string
  additionalProperty?: { '@type': 'PropertyValue'; name: string; value: string }
  aggregateRating?: { '@type': 'AggregateRating'; ratingValue: number; reviewCount: number }
}

// Broker entity built strictly from real, publicly available broker data. The
// physical office location (lat/lng from the broker's `location` GeoJSON point)
// is represented as GeoCoordinates — never a service radius. Ratings only come
// from real approved reviews (avgRating/totalReviews), never from badges or
// subscriptions. No internal IDs, ownership, or subscription data are emitted.
export function brokerLocalBusinessJsonLd(input: BrokerEntityInput): BrokerLocalBusinessLd {
  const address: BrokerLocalBusinessLd['address'] = {
    '@type': 'PostalAddress',
    ...(input.city ? { addressLocality: input.city } : {}),
    ...(input.state ? { addressRegion: input.state } : {}),
    ...(input.postalCode ? { postalCode: input.postalCode } : {}),
    addressCountry: input.countryCode || 'US',
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${input.url}#broker`,
    name: input.name,
    ...(input.description ? { description: input.description } : {}),
    url: input.url,
    ...(input.image ? { image: input.image } : {}),
    address,
    ...(typeof input.latitude === 'number' && typeof input.longitude === 'number' ? {
      geo: {
        '@type': 'GeoCoordinates',
        latitude: input.latitude,
        longitude: input.longitude,
      },
    } : {}),
    ...(input.telephone ? { telephone: input.telephone } : {}),
    ...(input.email ? { email: input.email } : {}),
    ...(input.nmls ? { additionalProperty: { '@type': 'PropertyValue', name: 'NMLS', value: input.nmls } } : {}),
    ...(input.totalReviews > 0 && input.avgRating > 0 ? {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: input.avgRating,
        reviewCount: input.totalReviews,
      },
    } : {}),
  }
}
