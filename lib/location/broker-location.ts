import { geocodeUSAddress, type ResolvedUSLocation } from './google-place'
import { isUsStateCode } from '@/lib/us-states'

export type BrokerAddressFields = {
  officeAddress: string
  city?: string | null
  state?: string | null
  pinCode?: string | null
}

export type BrokerLocationPatch = {
  normalizedAddress: string
  googlePlaceId?: string
  locationCountryCode: 'US'
  location: { type: 'Point'; coordinates: [number, number] }
}

export function isValidLatitude(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -90 && value <= 90
}

export function isValidLongitude(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -180 && value <= 180
}

export function isValidCoordinatePair(latitude: unknown, longitude: unknown) {
  return isValidLatitude(latitude) && isValidLongitude(longitude)
}

export function buildBrokerAddress(input: BrokerAddressFields) {
  return [input.officeAddress, input.city, input.state, input.pinCode]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(', ')
}

export function toBrokerLocationPatch(resolved: ResolvedUSLocation): BrokerLocationPatch | null {
  if (!isValidCoordinatePair(resolved.latitude, resolved.longitude)) return null
  return {
    normalizedAddress: resolved.normalizedAddress || buildBrokerAddress({ officeAddress: resolved.normalizedAddress }),
    googlePlaceId: resolved.placeId,
    locationCountryCode: 'US',
    location: { type: 'Point', coordinates: [resolved.longitude, resolved.latitude] },
  }
}

export async function resolveBrokerLocation(input: BrokerAddressFields): Promise<BrokerLocationPatch | null> {
  const address = buildBrokerAddress(input)
  if (!address) return null
  try {
    const resolved = await geocodeUSAddress(address)
    return toBrokerLocationPatch(resolved)
  } catch (error) {
    console.info('[LOCATION] geocoding failed', { address, error: error instanceof Error ? error.message : 'Unknown error' })
    return null
  }
}

export function locationHasValidCoordinates(location: unknown) {
  if (!location || typeof location !== 'object') return false
  const value = location as { coordinates?: unknown }
  if (!Array.isArray(value.coordinates) || value.coordinates.length !== 2) return false
  const [longitude, latitude] = value.coordinates
  return isValidCoordinatePair(latitude, longitude)
}

// Strict GeoJSON point check: `type` must be "Point" and coordinates must be a
// [longitude, latitude] pair within valid ranges. The broker's stored location
// is always a GeoJSON Point; a malformed shape must never be persisted.
export function isValidGeoJsonPoint(location: unknown): boolean {
  if (!location || typeof location !== 'object') return false
  const value = location as { type?: unknown; coordinates?: unknown }
  if (value.type !== 'Point') return false
  return locationHasValidCoordinates(value)
}

// US ZIP codes are 5 digits, optionally with a 4-digit +4 extension
// (e.g. "78701" or "78701-1234").
const US_ZIP_PATTERN = /^\d{5}(-\d{4})?$/

export function isValidUsZip(value: unknown): value is string {
  return typeof value === 'string' && US_ZIP_PATTERN.test(value.trim())
}

export class InvalidUSLocationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidUSLocationError'
  }
}

// Authoritative server-side validation of a Google-resolved US location before
// it is persisted as the broker office. Throws a specific, user-safe message
// for each failure so the client never persists an arbitrary location.
export function requireValidResolvedUSLocation(resolved: Pick<ResolvedUSLocation, 'countryCode' | 'city' | 'state' | 'zip' | 'latitude' | 'longitude'>): void {
  if (resolved.countryCode !== 'US') throw new InvalidUSLocationError('Only US office locations are supported')
  if (!resolved.city) throw new InvalidUSLocationError('A US city could not be determined for the selected location')
  if (!resolved.state || !isUsStateCode(resolved.state)) {
    throw new InvalidUSLocationError('A valid US state could not be determined for the selected location')
  }
  if (!isValidUsZip(resolved.zip)) {
    throw new InvalidUSLocationError('A valid US ZIP code could not be determined for the selected location')
  }
  if (!isValidCoordinatePair(resolved.latitude, resolved.longitude)) {
    throw new InvalidUSLocationError('The selected location has invalid coordinates')
  }
}
