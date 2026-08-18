import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (p: string) => fs.readFileSync(p, 'utf8')
const listing = read('app/(public)/brokers/page.tsx')
const searchSection = read('components/sections/landing/SearchSection.tsx')
const searchLib = read('lib/search.ts')
const geocodeRoute = read('app/api/location/geocode/route.ts')

const ORIGINAL_FETCH = globalThis.fetch
function mockFetch(handler: (url: string | URL | Request, init?: RequestInit) => Promise<Response>) {
  globalThis.fetch = handler as typeof fetch
}

test('resolveSearchSubmission reuses the current location without a geocode request', async () => {
  let calls = 0
  mockFetch(async () => { calls++; throw new Error('should not be called') })
  try {
    const { resolveSearchSubmission } = await import('../lib/search')
    const current = { normalizedAddress: 'Houston, TX', city: 'Houston', state: 'TX', zip: '77001', countryCode: 'US' as const, latitude: 29.7604, longitude: -95.3698, token: 'tok' }
    const result = await resolveSearchSubmission('Houston, TX', current)
    assert.equal(result.status, 'resolved')
    if (result.status === 'resolved') assert.equal(result.location.latitude, 29.7604)
    assert.equal(calls, 0, 'no geocode call when the text matches the current resolved location')
  } finally {
    globalThis.fetch = ORIGINAL_FETCH
  }
})

test('resolveSearchSubmission geocodes manual text on submit and returns coordinates + token', async () => {
  mockFetch(async (url) => {
    if (String(url).includes('/api/location/geocode')) {
      return new Response(JSON.stringify({ success: true, location: { normalizedAddress: 'Houston, TX', city: 'Houston', state: 'TX', zip: '77001', countryCode: 'US', latitude: 29.7604, longitude: -95.3698, token: 'signed-token' } }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    return new Response(JSON.stringify({}), { status: 404 })
  })
  try {
    const { resolveSearchSubmission } = await import('../lib/search')
    const result = await resolveSearchSubmission('Houston', null)
    assert.equal(result.status, 'resolved')
    if (result.status === 'resolved') {
      assert.equal(result.location.city, 'Houston')
      assert.equal(result.location.token, 'signed-token')
    }
  } finally {
    globalThis.fetch = ORIGINAL_FETCH
  }
})

test('resolveSearchSubmission falls back to text-only (no radius) when the location cannot be resolved', async () => {
  mockFetch(async () => new Response(JSON.stringify({ success: false }), { status: 400 }))
  try {
    const { resolveSearchSubmission } = await import('../lib/search')
    const result = await resolveSearchSubmission('XYZ_NOT_A_LOCATION', null)
    assert.equal(result.status, 'text-only')
    if (result.status === 'text-only') assert.equal(result.text, 'XYZ_NOT_A_LOCATION')
  } finally {
    globalThis.fetch = ORIGINAL_FETCH
  }
})

test('resolveSearchSubmission never reuses stale coordinates on unresolved text', async () => {
  mockFetch(async () => new Response(JSON.stringify({ success: false }), { status: 400 }))
  try {
    const { resolveSearchSubmission } = await import('../lib/search')
    // A stale Dallas selection must NOT leak into an unresolvable new query.
    const stale = { normalizedAddress: 'Dallas, TX', city: 'Dallas', state: 'TX', zip: '75201', countryCode: 'US' as const, latitude: 32.7767, longitude: -96.797, token: 'tok' }
    const result = await resolveSearchSubmission('XYZ_NOT_A_LOCATION', stale)
    assert.equal(result.status, 'text-only', 'must not reuse the stale location')
  } finally {
    globalThis.fetch = ORIGINAL_FETCH
  }
})

test('listing never geocodes arbitrary text (selection-driven search only)', () => {
  // The listing page must NOT call the geocoder or resolveSearchSubmission:
  // location search is initiated ONLY by selecting an autocomplete suggestion.
  assert.doesNotMatch(listing, /resolveSearchSubmission\(text, selectedLocation\)/)
  assert.doesNotMatch(listing, /\/api\/location\/geocode\?/)
  assert.doesNotMatch(listing, /onChange=\{\(e\) => \{[\s\S]{0,120}?geocode/)
})

test('Enter and submission select an autocomplete suggestion, never free-text search', () => {
  assert.match(listing, /else void handleSearchSubmit\(\)/)
  assert.match(listing, /const handleSearchSubmit = \(\) =>/)
  assert.match(listing, /locationSuggestions\[index\]/)
  assert.match(listing, /Select a location from the suggestions to search nearby brokers\./)
})

test('selection-driven handler prefers the highlighted suggestion then the first', () => {
  assert.match(listing, /activeSuggestionIndex >= 0 && activeSuggestionIndex < locationSuggestions\.length \? activeSuggestionIndex : 0/)
  assert.match(listing, /selectSuggestion\(index\)/)
})

test('no suggestions on submit shows a non-blocking hint and does not search', () => {
  const submitBlock = listing.slice(listing.indexOf('const handleSearchSubmit'))
  assert.match(submitBlock, /Select a location from the suggestions to search nearby brokers\./)
  assert.doesNotMatch(submitBlock, /resolveSearchSubmission/)
  assert.doesNotMatch(submitBlock, /setSearch\(text\)/)
})

test('stale selected-location state is cleared when the input text changes', () => {
  assert.match(listing, /setSelectedLocation\(null\)/)
  assert.match(listing, /setRadius\(25\)/)
  assert.match(listing, /setLocationError\(''\)/)
})

test('landing page resolves manual input through the shared pipeline and navigates with radius', () => {
  assert.match(searchSection, /resolveSearchSubmission\(text, selectedLocation\)/)
  assert.match(searchSection, /router\.push\(buildBrokerSearchUrl\(result\.location, ''\)\)/)
  assert.match(searchSection, /router\.push\(buildBrokerSearchUrl\(null, text\)\)/)
})

test('geocode route issues a signed token for radius searches', () => {
  assert.match(geocodeRoute, /geocodeUSAddress\(body\.address\)/)
  assert.match(geocodeRoute, /issueSearchLocationToken\(location\)/)
})

test('shared lib/search exposes the manual resolution helper', () => {
  assert.match(searchLib, /export async function resolveSearchSubmission/)
  assert.match(searchLib, /export type SearchSubmissionResult/)
  assert.match(searchLib, /\| \{ status: "resolved"; location: ResolvedLocation \}/)
  assert.match(searchLib, /\| \{ status: "text-only"; text: string \}/)
})
