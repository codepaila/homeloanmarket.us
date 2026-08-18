import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const listing = fs.readFileSync('app/(public)/brokers/page.tsx', 'utf8')
const searchLib = fs.readFileSync('lib/search.ts', 'utf8')

test('canonical URL persists the human-readable location, radius, coordinates, and token', () => {
  assert.match(listing, /setOrDelete\('location', selectedLocation\?\.normalizedAddress/)
  assert.match(listing, /setOrDelete\('radius', selectedLocation \? String\(radius\) : ''\)/)
  // The signed token + coordinates must survive in the URL so refresh,
  // pagination, and back/forward navigation restore the radius search.
  assert.match(listing, /setOrDelete\('locationToken', selectedLocation\?\.token \|\| ''\)/)
  assert.match(listing, /setOrDelete\('latitude', selectedLocation \? String\(selectedLocation\.latitude\) : ''\)/)
  assert.match(listing, /setOrDelete\('longitude', selectedLocation \? String\(selectedLocation\.longitude\) : ''\)/)
})

test('hydration restores location and radius from URL params', () => {
  assert.match(listing, /const locationText = params\.get\('location'\) \|\| params\.get\('locationLabel'\) \|\| ''/)
  assert.match(listing, /const radiusParamStr = params\.get\('radius'\)/)
  assert.match(listing, /radiusParam >= 0 && radiusParam <= 100/)
  assert.match(listing, /DEFAULT_RADIUS_MILES/)
})

test('hydration restores a confirmed location from URL coordinates, not geocoding', () => {
  assert.match(listing, /parseResolvedLocation\(params\)/)
  assert.match(listing, /setSelectedLocation\(resolvedLocation\)/)
  assert.doesNotMatch(listing, /resolveLocationText/, 'no geocode fallback is needed for confirmed locations')
})

test('legacy locationLabel URLs fall back to the new location param', () => {
  assert.match(searchLib, /params\.get\("locationLabel"\)/)
})

test('clearing search removes location and resets radius state', () => {
  assert.match(listing, /setSelectedLocation\(null\)/)
  assert.match(listing, /setRadius\(25\)/)
})

test('radius is committed to the URL immediately on change and preserved across filters', () => {
  assert.match(listing, /radius, selectedLocation, urlHydrated/)
  assert.match(listing, /setOrDelete\('radius', selectedLocation \? String\(radius\) : ''\)/)
})

test('free-text typing does not write URL radius params; only a confirmed location does', () => {
  assert.match(listing, /setOrDelete\('radius', selectedLocation \? String\(radius\) : ''\)/)
  assert.match(searchLib, /else if \(text\)/, 'text branch builds a plain search')
})
