import { geocodeUSAddress, type ResolvedUSLocation } from './google-place'

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
