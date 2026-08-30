import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const listing = fs.readFileSync('app/(public)/brokers/page.tsx', 'utf8')
const hook = fs.readFileSync('hooks/useClient.ts', 'utf8')
const autocompleteRoute = fs.readFileSync('app/api/location/autocomplete/route.ts', 'utf8')

test('search input value updates immediately from local state', () => {
  assert.match(listing, /value=\{searchInput\}/)
  assert.match(listing, /onChange=\{\(e\) => \{\n?\s*(autocompleteUserInteractedRef\.current = true\n?\s*)?setSearchInput\(e\.target\.value\)/)
  assert.doesNotMatch(listing, /setSearchInput\(e\.target\.value\).*setTimeout/)
})

test('autocomplete is debounced; typing never triggers a broker query', () => {
  // Only the autocomplete fetch is debounced. The broker query must NOT be
  // fired from a typing debounce (it runs exclusively on explicit submit).
  const debounceCount = (listing.match(/\}, 200\)/g) || []).length
  assert.ok(debounceCount >= 1, 'autocomplete debounces to ~200ms')
  assert.doesNotMatch(listing, /setSearch\(searchInput\.trim\(\)\)/, 'typing must not commit the broker query')
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

test('Enter selects a suggestion and never free-text geocodes', () => {
  assert.match(listing, /else void handleSearchSubmit\(\)/)
  assert.doesNotMatch(listing, /resolveSearchSubmission\(text, selectedLocation\)/)
  assert.match(listing, /locationSuggestions\[activeSuggestionIndex\]/)
})

test('clear search resets input, query, URL, and suggestions', () => {
  assert.match(listing, /aria-label="Clear search"/)
  assert.match(listing, /onClick=\{\(\) => \{ setSearchInput\(''\); setSearch\(''\); setCommittedSearch\(''\); setSelectedLocation\(null\); setRadius\(25\); setLocationSuggestions\(\[\]\); setLocationError\(''\); setActiveSuggestionIndex\(-1\) \}\}/)
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
  assert.match(hook, /locationToken/)
  assert.match(listing, /setOrDelete\('location', selectedLocation\?\.normalizedAddress/)
  assert.match(listing, /setOrDelete\('radius', selectedLocation \? String\(radius\) : ''\)/)
  // The canonical location (coordinates + signed token) is persisted in the URL
  // so refresh, pagination, and back/forward restore the radius search.
  assert.match(listing, /setOrDelete\('latitude', selectedLocation \? String\(selectedLocation\.latitude\) : ''\)/)
  assert.match(listing, /setOrDelete\('longitude', selectedLocation \? String\(selectedLocation\.longitude\) : ''\)/)
  assert.match(listing, /setOrDelete\('locationToken', selectedLocation\?\.token \|\| ''\)/)
})

test('suggestions support keyboard navigation and ARIA combobox semantics', () => {
  assert.match(listing, /role="combobox"/)
  assert.match(listing, /aria-expanded/)
  assert.match(listing, /aria-activedescendant/)
  assert.match(listing, /ArrowDown/)
  assert.match(listing, /ArrowUp/)
  assert.match(listing, /Escape/)
})

test('autocomplete closes when clicking outside the search component', () => {
  assert.match(listing, /addEventListener\('pointerdown'/)
  assert.match(listing, /searchRef\.current\.contains\(e\.target as Node\)/)
  assert.match(listing, /removeEventListener\('pointerdown'/)
})
