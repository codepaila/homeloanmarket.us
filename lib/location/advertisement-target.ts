import { resolveUSPlace } from './google-place'

export async function resolveAdvertisementTarget(input: {
  locationLabel?: string
  countryCode?: string
  city?: string
  state?: string
  zip?: string
  googlePlaceId?: string
  latitude?: number
  longitude?: number
  radiusMiles: number
}) {
  if (!input.googlePlaceId) throw new Error('A validated Google place is required for advertisement targeting')
  if (!Number.isFinite(input.radiusMiles) || input.radiusMiles <= 0 || input.radiusMiles > 100) throw new Error('Advertisement radius must be between 1 and 100 miles')
  const location = await resolveUSPlace(input.googlePlaceId)
  return {
    locationLabel: location.normalizedAddress,
    countryCode: 'US',
    city: location.city,
    state: location.state,
    zip: location.zip,
    googlePlaceId: location.placeId,
    latitude: location.latitude,
    longitude: location.longitude,
    radiusMiles: input.radiusMiles,
  }
}
