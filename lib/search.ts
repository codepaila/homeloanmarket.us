// Shared broker-search location/radius helpers.
//
// Single source of truth for:
// - the default radius applied to confirmed Google location selections
// - building the broker listing search URL from a resolved location
// - the shared location shape used by the home search and broker listing page
//
// Radius search is enabled ONLY by a Google-autocomplete selection that carries
// a server-issued location token (and coordinates). Manual free-text search
// never activates radius.

import type { SearchLocation } from "./location/search-token"

export const DEFAULT_RADIUS_MILES = 25

// A resolved Google Place selection: the canonical SearchLocation plus the
// server-issued token the broker API requires for radius searches.
export type ResolvedLocation = SearchLocation & { token?: string }

/**
 * Build the /brokers URL for a confirmed location selection (radius active)
 * or a plain free-text search (no radius).
 */
export function buildBrokerSearchUrl(
  location: ResolvedLocation | SearchLocation | null,
  text: string,
  radius: number = DEFAULT_RADIUS_MILES,
): string {
  const params = new URLSearchParams()
  if (location) {
    params.set("location", location.normalizedAddress)
    if (location.city) params.set("locationCity", location.city)
    if (location.state) params.set("locationState", location.state)
    if (location.zip) params.set("locationZip", location.zip)
    params.set("latitude", String(location.latitude))
    params.set("longitude", String(location.longitude))
    if ("token" in location && location.token) params.set("locationToken", location.token)
    params.set("radius", String(radius))
  } else if (text) {
    params.set("search", text)
  }
  const queryString = params.toString()
  return queryString ? `/brokers?${queryString}` : "/brokers"
}

/**
 * Parse a resolved location out of broker search query params. Returns null
 * when the URL does not carry a confirmed Google location (i.e. no valid
 * coordinate pair). A bare `location` text param alone is NOT treated as a
 * confirmed location — it must be accompanied by coordinates.
 */
export function parseResolvedLocation(params: URLSearchParams): ResolvedLocation | null {
  const latitudeStr = params.get("latitude")
  const longitudeStr = params.get("longitude")
  if (latitudeStr === null || longitudeStr === null) return null
  const latitude = Number(latitudeStr)
  const longitude = Number(longitudeStr)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  const normalizedAddress = params.get("location") || params.get("locationLabel") || ""
  if (!normalizedAddress) return null
  return {
    normalizedAddress,
    city: params.get("locationCity") || "",
    state: params.get("locationState") || "",
    zip: params.get("locationZip") || "",
    countryCode: "US",
    latitude,
    longitude,
    placeId: params.get("locationPlaceId") || undefined,
    token: params.get("locationToken") || undefined,
  }
}

export type SearchSubmissionResult =
  | { status: "resolved"; location: ResolvedLocation }
  | { status: "text-only"; text: string }
  | { status: "error"; text: string; message: string }

/**
 * Resolve a broker search submission into a canonical location. This is the
 * single entry point for BOTH Google-autocomplete selections (already resolved)
 * and manually typed text:
 *
 * - If the typed text already matches the currently resolved location, reuse it
 *   (no extra geocode request).
 * - Otherwise resolve the text through the server-side geocoder. A successful
 *   geocode returns coordinates + a signed token so radius search activates.
 * - If the text cannot be resolved to a location, the caller falls back to a
 *   plain text search WITHOUT radius — stale coordinates are never reused.
 *
 * Manual resolution only ever runs on explicit submit (Enter / search button),
 * never on every keystroke.
 */
export async function resolveSearchSubmission(
  text: string,
  currentLocation: ResolvedLocation | null,
): Promise<SearchSubmissionResult> {
  const value = text.trim()
  if (!value) return { status: "text-only", text: value }

  // Dedupe: an unchanged, already-selected location must not be geocoded again.
  if (currentLocation && currentLocation.normalizedAddress === value) {
    return { status: "resolved", location: currentLocation }
  }

  try {
    const response = await fetch("/api/location/geocode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: value }),
    })
    const data = await response.json()
    if (!response.ok || !data.location) {
      // Unresolvable text: text-only search, no radius, no stale coordinates.
      return { status: "text-only", text: value }
    }
    return { status: "resolved", location: data.location as ResolvedLocation }
  } catch {
    return { status: "error", text: value, message: "Location could not be resolved. Please try again." }
  }
}
