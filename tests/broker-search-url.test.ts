import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const listing = fs.readFileSync('app/(public)/brokers/page.tsx', 'utf8')

test('canonical URL uses human-readable location and radius instead of an opaque token', () => {
  assert.match(listing, /setOrDelete\('location', selectedLocation\?\.normalizedAddress/)
  assert.match(listing, /setOrDelete\('radius', radius > 0 \? String\(radius\) : ''\)/)
  assert.match(listing, /params\.delete\('locationToken'\)/)
  assert.match(listing, /params\.delete\('locationLatitude'\)/)
})

test('hydration restores location and radius from URL params', () => {
  assert.match(listing, /const locationText = params\.get\('location'\) \|\| params\.get\('locationLabel'\) \|\| ''/)
  assert.match(listing, /const radiusParam = Number\(params\.get\('radius'\)\)/)
  assert.match(listing, /radiusParam > 0 && radiusParam <= 100/)
  assert.match(listing, /setRadiusEnabled\(radiusValue > 0\)/)
})

test('hydration resolves the location string server-side for coordinates', () => {
  assert.match(listing, /\/api\/location\/geocode/)
  assert.match(listing, /resolveLocationText/)
})

test('legacy locationLabel URLs fall back to the new location param', () => {
  assert.match(listing, /params\.get\('locationLabel'\)/)
  assert.match(listing, /params\.delete\('locationLabel'\)/)
})

test('clearing search removes location and radius from URL state', () => {
  assert.match(listing, /setSelectedLocation\(null\)/)
  assert.match(listing, /setRadius\(0\)/)
})

test('radius is committed to the URL immediately on change', () => {
  assert.match(listing, /radius, specialization, selectedLocation, urlHydrated/)
})

test('resolving location suppresses transient free-text and autocomplete requests', () => {
  assert.match(listing, /const \[resolvingLocation, setResolvingLocation\] = useState\(false\)/)
  assert.match(listing, /if \(resolvingLocation\) return/)
})
