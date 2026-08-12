import crypto from 'crypto'

export type SearchLocation = {
  placeId?: string
  normalizedAddress: string
  city: string
  state: string
  zip: string
  countryCode: 'US'
  latitude: number
  longitude: number
}

type SearchLocationToken = SearchLocation & { exp: number }

function secret() {
  if (!process.env.AUTH_SECRET) throw new Error('AUTH_SECRET is not configured')
  return process.env.AUTH_SECRET
}

function signature(payload: string) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url')
}

export function issueSearchLocationToken(location: SearchLocation, ttlSeconds = 15 * 60) {
  const payload = Buffer.from(JSON.stringify({ ...location, exp: Math.floor(Date.now() / 1000) + ttlSeconds })).toString('base64url')
  return `${payload}.${signature(payload)}`
}

export function verifySearchLocationToken(token: string): SearchLocation {
  const [payload, providedSignature] = token.split('.')
  const expectedSignature = payload ? signature(payload) : ''
  if (!payload || !providedSignature || providedSignature.length !== expectedSignature.length || !crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(providedSignature))) {
    throw new Error('Invalid search location token')
  }
  const value = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SearchLocationToken
  if (value.exp <= Math.floor(Date.now() / 1000) || value.countryCode !== 'US') throw new Error('Expired search location token')
  if (!Number.isFinite(value.latitude) || value.latitude < -90 || value.latitude > 90) throw new Error('Invalid search location token')
  if (!Number.isFinite(value.longitude) || value.longitude < -180 || value.longitude > 180) throw new Error('Invalid search location token')
  return value
}
