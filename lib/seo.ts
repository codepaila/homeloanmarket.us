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
