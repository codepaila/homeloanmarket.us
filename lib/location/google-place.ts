type GoogleAddressComponent = {
  longText?: string
  shortText?: string
  long_name?: string
  short_name?: string
  types?: string[]
}

export type ResolvedUSLocation = {
  placeId?: string
  normalizedAddress: string
  city: string
  state: string
  zip: string
  countryCode: 'US'
  latitude: number
  longitude: number
}

function googleKey() {
  const key = process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.GOOGLE_MAPS_SERVER_KEY || process.env.GOOGLE_PLACES_API_KEY
  if (!key) throw new Error('A server-side Google location key is not configured')
  return key
}

function component(components: GoogleAddressComponent[], type: string) {
  return components.find((item) => item.types?.includes(type))
}

function buildLocation(input: {
  placeId?: string
  formattedAddress?: string
  components?: GoogleAddressComponent[]
  latitude?: number
  longitude?: number
}): ResolvedUSLocation {
  const components = input.components || []
  const country = component(components, 'country')
  const latitude = input.latitude
  const longitude = input.longitude
  if ((country?.shortText || country?.short_name)?.toUpperCase() !== 'US') throw new Error('Only US locations are supported')
  if (typeof latitude !== 'number' || latitude < -90 || latitude > 90) throw new Error('Invalid location latitude')
  if (typeof longitude !== 'number' || longitude < -180 || longitude > 180) throw new Error('Invalid location longitude')

  return {
    placeId: input.placeId,
    normalizedAddress: input.formattedAddress?.trim() || '',
    city: component(components, 'locality')?.longText || component(components, 'locality')?.long_name || component(components, 'postal_town')?.longText || component(components, 'postal_town')?.long_name || '',
    state: component(components, 'administrative_area_level_1')?.shortText || component(components, 'administrative_area_level_1')?.short_name || '',
    zip: component(components, 'postal_code')?.shortText || component(components, 'postal_code')?.short_name || '',
    countryCode: 'US',
    latitude,
    longitude,
  }
}

export async function autocompleteUSPlaces(input: string) {
  const value = input.trim()
  if (value.length < 2) return []
  const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': googleKey(),
      'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat',
    },
    body: JSON.stringify({ input: value, includedRegionCodes: ['us'] }),
    cache: 'no-store',
  })
  if (!response.ok) throw new Error('Google location autocomplete failed')
  const data = await response.json() as { suggestions?: Array<{ placePrediction?: { placeId?: string; text?: { text?: string }; structuredFormat?: unknown } }> }
  return (data.suggestions || [])
    .map((suggestion) => suggestion.placePrediction)
    .filter((prediction): prediction is NonNullable<typeof prediction> => Boolean(prediction?.placeId && prediction.text?.text))
    .map((prediction) => ({ placeId: prediction.placeId!, label: prediction.text!.text! }))
}

export async function resolveUSPlace(placeId: string): Promise<ResolvedUSLocation> {
  if (!/^[A-Za-z0-9._:-]+$/.test(placeId)) throw new Error('Invalid Google place ID')
  const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=en&regionCode=US`, {
    headers: {
      'X-Goog-Api-Key': googleKey(),
      'X-Goog-FieldMask': 'id,formattedAddress,addressComponents,location',
    },
    cache: 'no-store',
  })
  if (!response.ok) throw new Error('Google place resolution failed')
  const data = await response.json() as {
    id?: string
    formattedAddress?: string
    addressComponents?: GoogleAddressComponent[]
    location?: { latitude?: number; longitude?: number }
  }
  return buildLocation({
    placeId: data.id || placeId,
    formattedAddress: data.formattedAddress,
    components: data.addressComponents,
    latitude: data.location?.latitude,
    longitude: data.location?.longitude,
  })
}

export async function geocodeUSAddress(address: string): Promise<ResolvedUSLocation> {
  const value = address.trim()
  if (!value) throw new Error('Address is required')
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
  url.searchParams.set('address', value)
  url.searchParams.set('components', 'country:US')
  url.searchParams.set('key', googleKey())
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error('Google geocoding failed')
  const data = await response.json() as {
    status?: string
    results?: Array<{
      place_id?: string
      formatted_address?: string
      address_components?: GoogleAddressComponent[]
      geometry?: { location?: { lat?: number; lng?: number } }
    }>
  }
  const result = data.results?.[0]
  if (data.status !== 'OK' || !result) throw new Error('Address could not be resolved')
  return buildLocation({
    placeId: result.place_id,
    formattedAddress: result.formatted_address,
    components: result.address_components,
    latitude: result.geometry?.location?.lat,
    longitude: result.geometry?.location?.lng,
  })
}
