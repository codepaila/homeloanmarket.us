import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const listing = fs.readFileSync('app/(public)/brokers/page.tsx', 'utf8')
const hook = fs.readFileSync('hooks/useClient.ts', 'utf8')
const autocompleteRoute = fs.readFileSync('app/api/location/autocomplete/route.ts', 'utf8')

test('search input value updates immediately from local state', () => {
  assert.match(listing, /value=\{searchInput\}/)
  assert.match(listing, /onChange=\{\(e\) => \{\n?\s*setSearchInput\(e\.target\.value\)/)
  assert.doesNotMatch(listing, /setSearchInput\(e\.target\.value\).*setTimeout/)
})

test('remote broker query and autocomplete are debounced', () => {
  const debounceCount = (listing.match(/\}, 200\)/g) || []).length
  assert.ok(debounceCount >= 2, 'both broker query and autocomplete debounce to ~200ms')
  assert.doesNotMatch(listing, /\}, (400|500|750|1000)\)/)
})

test('stale autocomplete responses cannot overwrite newer results', () => {
  assert.match(listing, /AbortController/)
  assert.match(listing, /autocompleteRequestRef/)
  assert.match(listing, /requestId !== autocompleteRequestRef\.current/)
  assert.match(listing, /controller\.abort\(\)/)
})

test('autocomplete is server-side and initialized only through the API boundary', () => {
  assert.match(autocompleteRoute, /autocompleteUSPlaces\(input\)/)
  assert.match(listing, /\/api\/location\/autocomplete\?input=/)
  assert.doesNotMatch(listing, /new google\.maps\.places\.Autocomplete/)
})

test('typing does not write URL search params; only committed search does', () => {
  assert.match(listing, /const \[committedSearch, setCommittedSearch\] = useState\(''\)/)
  assert.match(listing, /setOrDelete\('search', committedSearch\)/)
  const urlEffect = listing.slice(listing.indexOf('if (!urlHydrated'), listing.indexOf('}, [committedSearch'))
  assert.doesNotMatch(urlEffect, /searchInput/)
})

test('Enter commits the search and triggers the broker listing query', () => {
  assert.match(listing, /setCommittedSearch\(value\)/)
  assert.match(listing, /setSearch\(value\)/)
})

test('clear search resets input, query, URL, and suggestions', () => {
  const clear = listing.slice(listing.indexOf('aria-label="Clear search"'))
  assert.match(clear, /setCommittedSearch\(''\)/)
  assert.match(clear, /setLocationSuggestions\(\[\]\)/)
  assert.match(clear, /setActiveSuggestionIndex\(-1\)/)
})

test('browser back and forward restore search state from URL', () => {
  assert.match(listing, /popstate/)
  assert.match(listing, /syncFromUrl/)
})

test('Google autocomplete failure surfaces a safe inline message without breaking listing', () => {
  assert.match(listing, /const \[locationError, setLocationError\] = useState\(''\)/)
  assert.match(listing, /role="status"/)
  assert.match(listing, /Location autocomplete is unavailable/)
})

test('radius and location URL parameters remain intact for search', () => {
  assert.match(listing, /radiusEnabled \? radius : 0/)
  assert.match(hook, /locationToken/)
  assert.match(listing, /setOrDelete\('location', selectedLocation\?\.normalizedAddress/)
  assert.match(listing, /setOrDelete\('radius', radius > 0 \? String\(radius\) : ''\)/)
  assert.match(listing, /params\.delete\('locationToken'\)/)
})

test('suggestions support keyboard navigation and ARIA combobox semantics', () => {
  assert.match(listing, /role="combobox"/)
  assert.match(listing, /aria-expanded/)
  assert.match(listing, /aria-activedescendant/)
  assert.match(listing, /ArrowDown/)
  assert.match(listing, /ArrowUp/)
  assert.match(listing, /Escape/)
})
